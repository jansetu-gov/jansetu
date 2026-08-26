
-- =============================
-- TYPES & ENUMS
-- =============================
CREATE TYPE public.user_role AS ENUM ('citizen', 'officer', 'admin');
CREATE TYPE public.app_status AS ENUM ('submitted', 'under_review', 'approved', 'disbursed');
CREATE TYPE public.anomaly_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- =============================
-- PROFILES
-- =============================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text,
  role public.user_role NOT NULL DEFAULT 'citizen',
  display_name text,
  language text NOT NULL DEFAULT 'en',
  assigned_district text,
  assigned_state text,
  large_fonts boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS public.user_role LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'citizen')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Admins full access profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM public.get_user_role(auth.uid()));

-- =============================
-- SCHEMES
-- =============================
CREATE TABLE public.schemes (
  id text PRIMARY KEY,
  name text NOT NULL,
  department text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  state_availability text[] NOT NULL DEFAULT ARRAY['ALL'],
  eligibility_income_limit integer,
  eligibility_age_min integer,
  eligibility_age_max integer,
  eligibility_occupation text[],
  benefits text NOT NULL,
  required_documents text[] NOT NULL,
  application_process text[] NOT NULL,
  application_url text,
  csc_info text,
  keywords text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_updated date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view schemes" ON public.schemes FOR SELECT USING (true);
CREATE POLICY "Admins manage schemes" ON public.schemes FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- =============================
-- DISTRICT DATA (Fund Utilization)
-- =============================
CREATE TABLE public.district_scheme_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  district text NOT NULL,
  block text,
  scheme_id text REFERENCES public.schemes(id),
  scheme_name text NOT NULL,
  financial_year text NOT NULL DEFAULT '2024-25',
  allocated_cr numeric(10,2) NOT NULL DEFAULT 0,
  released_cr numeric(10,2) NOT NULL DEFAULT 0,
  utilized_cr numeric(10,2) NOT NULL DEFAULT 0,
  beneficiaries integer NOT NULL DEFAULT 0,
  physical_progress_pct numeric(5,2) NOT NULL DEFAULT 0,
  monthly_data jsonb NOT NULL DEFAULT '[]',
  last_updated date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.district_scheme_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view district data" ON public.district_scheme_data FOR SELECT USING (true);
CREATE POLICY "Officers update own district" ON public.district_scheme_data FOR UPDATE TO authenticated
  USING (
    district = (SELECT assigned_district FROM public.profiles WHERE id = auth.uid())
    OR public.get_user_role(auth.uid()) = 'admin'
  );

-- =============================
-- BOOKMARKS
-- =============================
CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheme_id text NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, scheme_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================
-- DEMO APPLICATIONS
-- =============================
CREATE TABLE public.demo_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheme_id text NOT NULL REFERENCES public.schemes(id),
  scheme_name text NOT NULL,
  status public.app_status NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.demo_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own applications" ON public.demo_applications
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================
-- RTI QUERIES
-- =============================
CREATE TABLE public.rti_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE NOT NULL,
  name text NOT NULL,
  contact text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rti_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit RTI" ON public.rti_queries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view own RTI" ON public.rti_queries FOR SELECT USING (true);
CREATE POLICY "Admins manage RTI" ON public.rti_queries FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- =============================
-- NEWS & UPDATES
-- =============================
CREATE TABLE public.news_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  published_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.news_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view news" ON public.news_updates FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage news" ON public.news_updates FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- =============================
-- SEED: SCHEMES (15 realistic demo schemes)
-- =============================
INSERT INTO public.schemes (id, name, department, category, description, state_availability, eligibility_income_limit, eligibility_age_min, eligibility_age_max, eligibility_occupation, benefits, required_documents, application_process, application_url, csc_info, keywords) VALUES
('PM-KISAN', 'PM Kisan Samman Nidhi', 'Ministry of Agriculture', 'Agriculture', 'Direct income support of ₹6,000 per year to small and marginal farmer families across India.', ARRAY['ALL'], 200000, 18, 70, ARRAY['farmer'], '₹6,000 per year in three equal installments of ₹2,000 directly to bank account.', ARRAY['Aadhaar Card', 'Bank Passbook', 'Land Records', 'Farmer Registration'], ARRAY['Register on PM-Kisan portal or visit nearest CSC', 'Submit Aadhaar-linked bank account details', 'Land verification by local patwari', 'Approval and enrollment by state govt'], 'https://pmkisan.gov.in', 'Visit nearest Common Service Centre (CSC) or Krishi Bhavan', ARRAY['farmer', 'agriculture', 'kisan', 'kheti', 'farming', 'financial help', 'zameen', 'income']),

('PMFBY', 'Pradhan Mantri Fasal Bima Yojana', 'Ministry of Agriculture', 'Agriculture', 'Crop insurance scheme providing financial support to farmers suffering crop loss or damage due to unforeseen events.', ARRAY['ALL'], 300000, 18, NULL, ARRAY['farmer'], 'Coverage for crop loss with insurance amount up to sum insured. Premium subsidy by government.', ARRAY['Aadhaar Card', 'Bank Account', 'Land Records', 'Sowing Certificate'], ARRAY['Apply through bank or insurance company or CSC', 'Submit crop and land details', 'Pay nominal premium', 'Claim during crop loss within 72 hours'], 'https://pmfby.gov.in', 'Nearest bank branch or Common Service Centre', ARRAY['crop', 'insurance', 'fasal', 'bima', 'farmer', 'agriculture', 'loss']),

('PMAY-G', 'Pradhan Mantri Awaas Yojana - Gramin', 'Ministry of Rural Development', 'Housing', 'Provides financial assistance to rural households for construction of a pucca house.', ARRAY['ALL'], 120000, 18, NULL, ARRAY['rural worker', 'BPL household'], '₹1.20 Lakh in plains, ₹1.30 Lakh in hilly/NE regions for house construction.', ARRAY['Aadhaar Card', 'BPL Certificate', 'Bank Account', 'SECC Data', 'Land ownership proof'], ARRAY['Village panchayat identifies beneficiary from SECC list', 'BDO verifies eligibility', 'Funds released in installments', 'Construction verification by government'], 'https://pmayg.nic.in', 'Visit Gram Panchayat office or Block Development Officer', ARRAY['housing', 'house', 'awaas', 'rural', 'gramin', 'construction', 'shelter']),

('PMJDY', 'Pradhan Mantri Jan Dhan Yojana', 'Ministry of Finance', 'Employment', 'Financial inclusion scheme providing bank accounts, insurance, and credit access to unbanked citizens.', ARRAY['ALL'], NULL, 10, NULL, ARRAY['unbanked citizen', 'daily wage worker', 'farmer'], 'Zero balance bank account, RuPay debit card, ₹2 lakh accident insurance, ₹30,000 life cover, overdraft facility up to ₹10,000.', ARRAY['Aadhaar Card', 'Passport-size photograph', 'Address Proof'], ARRAY['Visit any bank branch', 'Fill account opening form', 'Submit KYC documents', 'Account opened same day'], 'https://pmjdy.gov.in', 'Any nationalized bank or post office', ARRAY['bank', 'account', 'jan dhan', 'financial', 'insurance', 'employment', 'worker']),

('SSY', 'Sukanya Samriddhi Yojana', 'Ministry of Finance', 'Women & Child', 'Savings scheme for girl child offering attractive interest rate and tax benefits.', ARRAY['ALL'], NULL, 0, 10, ARRAY['girl child'], 'High interest rate (currently 8.2% p.a.), tax exemption under 80C, maturity amount at age 21.', ARRAY['Birth Certificate of girl child', 'Parent Aadhaar', 'Parent PAN Card', 'Photograph'], ARRAY['Open account in post office or authorized bank', 'Minimum deposit ₹250', 'Maximum ₹1.5 Lakh per year', 'Account matures when girl turns 21'], 'https://www.nsiindia.gov.in', 'Nearest post office or SBI/authorized bank', ARRAY['girl', 'beti', 'savings', 'sukanya', 'women', 'child', 'education fund']),

('BBBP', 'Beti Bachao Beti Padhao', 'Ministry of Women and Child Development', 'Women & Child', 'Programme to address declining child sex ratio and promote welfare and education of girl child.', ARRAY['ALL'], NULL, 0, 18, ARRAY['girl child', 'student'], 'Awareness campaigns, conditional cash transfer for girl education, scholarship support.', ARRAY['Aadhaar of child', 'School enrollment certificate', 'Bank account in child name', 'Birth certificate'], ARRAY['Register at Anganwadi or school', 'Enroll girl child in school', 'Maintain attendance', 'Benefits transferred directly'], 'https://wcd.nic.in/bbbp-schemes', 'Anganwadi centre or school', ARRAY['beti', 'girl', 'education', 'women', 'child', 'school']),

('PM-JAY', 'Ayushman Bharat PM-JAY', 'Ministry of Health', 'Health', 'World''s largest government funded health insurance scheme providing ₹5 lakh coverage per family per year for secondary and tertiary hospitalization.', ARRAY['ALL'], 200000, NULL, NULL, ARRAY['BPL family', 'daily wage worker', 'farmer', 'rural worker'], '₹5 Lakh per family per year health coverage at empanelled hospitals. Cashless treatment.', ARRAY['Aadhaar Card', 'Ration Card', 'SECC/RSBY card'], ARRAY['Check eligibility on Ayushman portal or call 14555', 'Get Ayushman card from CSC or hospital', 'Use card for cashless treatment at empanelled hospital'], 'https://pmjay.gov.in', 'Call helpline 14555 or visit nearest empanelled hospital', ARRAY['health', 'hospital', 'ayushman', 'medical', 'insurance', 'treatment', 'sehat']),

('NHPS', 'National Health Mission', 'Ministry of Health', 'Health', 'Universal health coverage initiative providing free essential medicines and diagnostics at government health facilities.', ARRAY['ALL'], NULL, NULL, NULL, ARRAY['all citizens'], 'Free medicines, free diagnostics, free diet, free blood, reduced healthcare cost at government facilities.', ARRAY['Aadhaar or any identity proof'], ARRAY['Visit nearest government health centre', 'Show Aadhaar', 'Receive free services'], 'https://nhm.gov.in', 'Nearest PHC, CHC, or District Hospital', ARRAY['health', 'medicine', 'hospital', 'free', 'treatment', 'nhm']),

('PMEGP', 'PM Employment Generation Programme', 'Ministry of MSME', 'MSME', 'Credit-linked subsidy scheme for generating employment through setting up new micro-enterprises in non-farm sector.', ARRAY['ALL'], 300000, 18, 45, ARRAY['entrepreneur', 'self-employed', 'educated unemployed'], '25%-35% subsidy on project cost up to ₹25 Lakh for service sector and ₹50 Lakh for manufacturing.', ARRAY['Aadhaar Card', 'PAN Card', 'Educational certificates', 'Project Report', 'Bank Statement'], ARRAY['Apply on Kviconline portal', 'Submit project report', 'Attend EDP training (10 days)', 'Bank appraisal and loan sanction'], 'https://kviconline.gov.in', 'District Industries Centre (DIC) or KVIC/KVIB office', ARRAY['business', 'enterprise', 'msme', 'employment', 'loan', 'subsidy', 'self employment']),

('MUDRA', 'MUDRA Yojana (Shishu, Kishore, Tarun)', 'Ministry of Finance', 'MSME', 'Provides loans up to ₹10 Lakh to non-corporate, non-farm small/micro enterprises.', ARRAY['ALL'], NULL, 18, 65, ARRAY['micro entrepreneur', 'small business', 'shopkeeper'], 'Shishu: up to ₹50,000. Kishore: ₹50,001 - ₹5 Lakh. Tarun: ₹5 Lakh - ₹10 Lakh. No collateral for Shishu.', ARRAY['Aadhaar', 'PAN', 'Business address proof', 'Quotation for machinery/goods'], ARRAY['Approach any bank or MFI with business plan', 'Submit MUDRA application form', 'Bank appraises and sanctions loan', 'Receive MUDRA card'], 'https://mudra.org.in', 'Any public sector bank, RRB, or microfinance institution', ARRAY['loan', 'business', 'mudra', 'msme', 'entrepreneur', 'small business', 'shop']),

('NSP-SC', 'National Scholarship Portal - SC Scholarship', 'Ministry of Social Justice', 'Scholarships', 'Pre-matric and post-matric scholarships for Scheduled Caste students to support education.', ARRAY['ALL'], 250000, 6, 25, ARRAY['student', 'SC category'], 'Monthly maintenance allowance, tuition fee reimbursement. Pre-matric: ₹225-₹525/month. Post-matric: up to ₹5,700/month.', ARRAY['Aadhaar', 'Caste Certificate', 'Income Certificate', 'Previous year marksheet', 'Bank Account', 'School bonafide'], ARRAY['Register on National Scholarship Portal', 'Fill application form', 'Submit to institution', 'Institution verification', 'Direct benefit transfer to bank'], 'https://scholarships.gov.in', 'School/college office or CSC', ARRAY['scholarship', 'education', 'student', 'SC', 'caste', 'fee', 'study']),

('PM-POSHAN', 'PM POSHAN Scheme (Mid-Day Meal)', 'Ministry of Education', 'Education', 'Free nutritious meal provided to children in government and aided schools to improve enrollment and nutrition.', ARRAY['ALL'], NULL, 6, 14, ARRAY['school student'], 'Free cooked nutritious mid-day meal every school day. Improves enrollment, attendance, and nutrition.', ARRAY['School enrollment certificate'], ARRAY['Automatic for all enrolled students in government schools'], 'https://pmposhan.education.gov.in', 'School principal or BEO', ARRAY['school', 'meal', 'food', 'education', 'children', 'nutrition']),

('IGNOAPS', 'Indira Gandhi National Old Age Pension Scheme', 'Ministry of Rural Development', 'Senior Citizens', 'Monthly pension to destitute senior citizens living below poverty line.', ARRAY['ALL'], 100000, 60, NULL, ARRAY['senior citizen', 'BPL'], '₹200/month for age 60-79, ₹500/month for age 80+. State governments may add top-up.', ARRAY['Aadhaar', 'Age proof', 'BPL certificate', 'Bank account'], ARRAY['Apply at Gram Panchayat or urban local body', 'Submit documents to BDO/SDO', 'Verification by local authority', 'Monthly pension credited to bank account'], 'https://nsap.nic.in', 'Gram Panchayat office or Block Development Office', ARRAY['pension', 'old age', 'senior citizen', 'elderly', 'BPL', 'monthly allowance']),

('MGNREGS', 'MGNREGA (Mahatma Gandhi Rural Employment Guarantee)', 'Ministry of Rural Development', 'Rural Development', 'Guarantees 100 days of wage employment per year to every rural household whose adult members volunteer to do unskilled manual work.', ARRAY['ALL'], NULL, 18, NULL, ARRAY['rural worker', 'unskilled worker', 'farmer'], '100 days guaranteed wage employment at statutory minimum wages. Payment within 15 days. Unemployment allowance if work not provided.', ARRAY['Aadhaar', 'Job Card (apply at Gram Panchayat)', 'Bank/Post Office account'], ARRAY['Apply for Job Card at Gram Panchayat', 'Submit work demand to Gram Panchayat', 'Work allocated within 15 days', 'Wages directly to bank account'], 'https://nrega.nic.in', 'Gram Panchayat office', ARRAY['employment', 'work', 'rural', 'wage', 'mgnrega', 'nrega', 'guarantee', 'job']),

('PMUY', 'Pradhan Mantri Ujjwala Yojana', 'Ministry of Petroleum', 'Women & Child', 'Provides free LPG connections to women from BPL households to ensure clean cooking fuel and improve health.', ARRAY['ALL'], 150000, 18, NULL, ARRAY['BPL household woman'], 'Free LPG connection, first refill and stove at subsidized rates. Security deposit waived.', ARRAY['Aadhaar', 'BPL/SECC Card', 'Bank Account', 'Ration Card', 'Address Proof'], ARRAY['Apply at nearest LPG distributor', 'Submit BPL documents', 'KYC verification', 'Free connection released within 7 days'], 'https://pmuy.gov.in', 'Nearest LPG distributor (HP/Bharat/Indane)', ARRAY['LPG', 'gas', 'ujjwala', 'cooking', 'women', 'BPL', 'fuel', 'clean energy']);

-- =============================
-- SEED: DISTRICT DATA (Demo)
-- =============================
-- Assam - Kamrup (Hackathon Demo Scenario)
INSERT INTO public.district_scheme_data (state, district, scheme_id, scheme_name, financial_year, allocated_cr, released_cr, utilized_cr, beneficiaries, physical_progress_pct, monthly_data) VALUES
('Assam', 'Kamrup', 'PM-KISAN', 'Agriculture Support Scheme', '2024-25', 15.00, 12.00, 4.20, 3850, 31.00, '[{"month":"Apr","allocated":15,"released":3,"utilized":0.8},{"month":"May","allocated":15,"released":5,"utilized":1.2},{"month":"Jun","allocated":15,"released":7,"utilized":1.9},{"month":"Jul","allocated":15,"released":9,"utilized":2.4},{"month":"Aug","allocated":15,"released":10,"utilized":3.1},{"month":"Sep","allocated":15,"released":11,"utilized":3.5},{"month":"Oct","allocated":15,"released":12,"utilized":4.2},{"month":"Nov","allocated":15,"released":12,"utilized":4.2},{"month":"Dec","allocated":15,"released":12,"utilized":4.2},{"month":"Jan","allocated":15,"released":12,"utilized":4.2},{"month":"Feb","allocated":15,"released":12,"utilized":4.2},{"month":"Mar","allocated":15,"released":12,"utilized":4.2}]'),
('Assam', 'Kamrup', 'PMFBY', 'Pradhan Mantri Fasal Bima Yojana', '2024-25', 8.50, 7.00, 5.80, 6200, 72.00, '[{"month":"Apr","allocated":8.5,"released":2,"utilized":1.2},{"month":"May","allocated":8.5,"released":3.5,"utilized":2.1},{"month":"Jun","allocated":8.5,"released":5,"utilized":3.0},{"month":"Jul","allocated":8.5,"released":6,"utilized":3.8},{"month":"Aug","allocated":8.5,"released":7,"utilized":5.0},{"month":"Sep","allocated":8.5,"released":7,"utilized":5.8},{"month":"Oct","allocated":8.5,"released":7,"utilized":5.8},{"month":"Nov","allocated":8.5,"released":7,"utilized":5.8},{"month":"Dec","allocated":8.5,"released":7,"utilized":5.8},{"month":"Jan","allocated":8.5,"released":7,"utilized":5.8},{"month":"Feb","allocated":8.5,"released":7,"utilized":5.8},{"month":"Mar","allocated":8.5,"released":7,"utilized":5.8}]'),
('Assam', 'Kamrup', 'MGNREGS', 'MGNREGA Rural Employment', '2024-25', 22.00, 18.50, 15.20, 12400, 69.00, '[{"month":"Apr","allocated":22,"released":4,"utilized":2.5},{"month":"May","allocated":22,"released":7,"utilized":5.0},{"month":"Jun","allocated":22,"released":10,"utilized":7.5},{"month":"Jul","allocated":22,"released":13,"utilized":10.0},{"month":"Aug","allocated":22,"released":15,"utilized":12.0},{"month":"Sep","allocated":22,"released":17,"utilized":13.5},{"month":"Oct","allocated":22,"released":18.5,"utilized":15.2},{"month":"Nov","allocated":22,"released":18.5,"utilized":15.2},{"month":"Dec","allocated":22,"released":18.5,"utilized":15.2},{"month":"Jan","allocated":22,"released":18.5,"utilized":15.2},{"month":"Feb","allocated":22,"released":18.5,"utilized":15.2},{"month":"Mar","allocated":22,"released":18.5,"utilized":15.2}]'),
('Assam', 'Kamrup', 'PMAY-G', 'PM Awaas Yojana Gramin', '2024-25', 18.00, 15.00, 13.20, 880, 78.00, '[{"month":"Apr","allocated":18,"released":3,"utilized":2.0},{"month":"May","allocated":18,"released":6,"utilized":4.0},{"month":"Jun","allocated":18,"released":9,"utilized":6.5},{"month":"Jul","allocated":18,"released":11,"utilized":8.5},{"month":"Aug","allocated":18,"released":13,"utilized":10.5},{"month":"Sep","allocated":22,"released":14,"utilized":12.0},{"month":"Oct","allocated":22,"released":15,"utilized":13.2},{"month":"Nov","allocated":22,"released":15,"utilized":13.2},{"month":"Dec","allocated":22,"released":15,"utilized":13.2},{"month":"Jan","allocated":22,"released":15,"utilized":13.2},{"month":"Feb","allocated":22,"released":15,"utilized":13.2},{"month":"Mar","allocated":22,"released":15,"utilized":13.2}]'),

-- Assam - Jorhat
('Assam', 'Jorhat', 'PM-KISAN', 'Agriculture Support Scheme', '2024-25', 12.00, 10.50, 9.20, 7100, 82.00, '[{"month":"Apr","allocated":12,"released":2.5,"utilized":1.5},{"month":"May","allocated":12,"released":5,"utilized":3.5},{"month":"Jun","allocated":12,"released":7,"utilized":5.5},{"month":"Jul","allocated":12,"released":8.5,"utilized":7.0},{"month":"Aug","allocated":12,"released":9.5,"utilized":8.2},{"month":"Sep","allocated":12,"released":10.5,"utilized":9.2},{"month":"Oct","allocated":12,"released":10.5,"utilized":9.2},{"month":"Nov","allocated":12,"released":10.5,"utilized":9.2},{"month":"Dec","allocated":12,"released":10.5,"utilized":9.2},{"month":"Jan","allocated":12,"released":10.5,"utilized":9.2},{"month":"Feb","allocated":12,"released":10.5,"utilized":9.2},{"month":"Mar","allocated":12,"released":10.5,"utilized":9.2}]'),
('Assam', 'Jorhat', 'MGNREGS', 'MGNREGA Rural Employment', '2024-25', 18.00, 16.00, 14.50, 9800, 85.00, '[{"month":"Apr","allocated":18,"released":3,"utilized":2.0},{"month":"May","allocated":18,"released":6,"utilized":5.0},{"month":"Jun","allocated":18,"released":9,"utilized":7.5},{"month":"Jul","allocated":18,"released":12,"utilized":10.5},{"month":"Aug","allocated":18,"released":14,"utilized":12.5},{"month":"Sep","allocated":18,"released":16,"utilized":14.5},{"month":"Oct","allocated":18,"released":16,"utilized":14.5},{"month":"Nov","allocated":18,"released":16,"utilized":14.5},{"month":"Dec","allocated":18,"released":16,"utilized":14.5},{"month":"Jan","allocated":18,"released":16,"utilized":14.5},{"month":"Feb","allocated":18,"released":16,"utilized":14.5},{"month":"Mar","allocated":18,"released":16,"utilized":14.5}]'),

-- Bihar - Patna
('Bihar', 'Patna', 'PM-KISAN', 'Agriculture Support Scheme', '2024-25', 25.00, 22.00, 19.50, 16500, 84.00, '[{"month":"Apr","allocated":25,"released":5,"utilized":3.5},{"month":"May","allocated":25,"released":9,"utilized":7.0},{"month":"Jun","allocated":25,"released":13,"utilized":10.5},{"month":"Jul","allocated":25,"released":17,"utilized":14.0},{"month":"Aug","allocated":25,"released":20,"utilized":17.0},{"month":"Sep","allocated":25,"released":22,"utilized":19.5},{"month":"Oct","allocated":25,"released":22,"utilized":19.5},{"month":"Nov","allocated":25,"released":22,"utilized":19.5},{"month":"Dec","allocated":25,"released":22,"utilized":19.5},{"month":"Jan","allocated":25,"released":22,"utilized":19.5},{"month":"Feb","allocated":25,"released":22,"utilized":19.5},{"month":"Mar","allocated":25,"released":22,"utilized":19.5}]'),
('Bihar', 'Patna', 'PMAY-G', 'PM Awaas Yojana Gramin', '2024-25', 30.00, 27.00, 22.50, 1500, 76.00, '[{"month":"Apr","allocated":30,"released":6,"utilized":4.0},{"month":"May","allocated":30,"released":11,"utilized":8.0},{"month":"Jun","allocated":30,"released":16,"utilized":12.0},{"month":"Jul","allocated":30,"released":21,"utilized":16.0},{"month":"Aug","allocated":30,"released":24,"utilized":19.5},{"month":"Sep","allocated":30,"released":27,"utilized":22.5},{"month":"Oct","allocated":30,"released":27,"utilized":22.5},{"month":"Nov","allocated":30,"released":27,"utilized":22.5},{"month":"Dec","allocated":30,"released":27,"utilized":22.5},{"month":"Jan","allocated":30,"released":27,"utilized":22.5},{"month":"Feb","allocated":30,"released":27,"utilized":22.5},{"month":"Mar","allocated":30,"released":27,"utilized":22.5}]'),
('Bihar', 'Patna', 'MGNREGS', 'MGNREGA Rural Employment', '2024-25', 35.00, 30.00, 26.50, 22000, 79.00, '[{"month":"Apr","allocated":35,"released":7,"utilized":5.0},{"month":"May","allocated":35,"released":12,"utilized":9.0},{"month":"Jun","allocated":35,"released":18,"utilized":14.0},{"month":"Jul","allocated":35,"released":23,"utilized":18.0},{"month":"Aug","allocated":35,"released":27,"utilized":22.0},{"month":"Sep","allocated":35,"released":30,"utilized":26.5},{"month":"Oct","allocated":35,"released":30,"utilized":26.5},{"month":"Nov","allocated":35,"released":30,"utilized":26.5},{"month":"Dec","allocated":35,"released":30,"utilized":26.5},{"month":"Jan","allocated":35,"released":30,"utilized":26.5},{"month":"Feb","allocated":35,"released":30,"utilized":26.5},{"month":"Mar","allocated":35,"released":30,"utilized":26.5}]'),

-- Bihar - Gaya
('Bihar', 'Gaya', 'PM-KISAN', 'Agriculture Support Scheme', '2024-25', 20.00, 14.00, 5.80, 4500, 28.00, '[{"month":"Apr","allocated":20,"released":2,"utilized":0.5},{"month":"May","allocated":20,"released":5,"utilized":1.5},{"month":"Jun","allocated":20,"released":8,"utilized":2.5},{"month":"Jul","allocated":20,"released":11,"utilized":3.5},{"month":"Aug","allocated":20,"released":13,"utilized":4.8},{"month":"Sep","allocated":20,"released":14,"utilized":5.8},{"month":"Oct","allocated":20,"released":14,"utilized":5.8},{"month":"Nov","allocated":20,"released":14,"utilized":5.8},{"month":"Dec","allocated":20,"released":14,"utilized":5.8},{"month":"Jan","allocated":20,"released":14,"utilized":5.8},{"month":"Feb","allocated":20,"released":14,"utilized":5.8},{"month":"Mar","allocated":20,"released":14,"utilized":5.8}]'),
('Bihar', 'Gaya', 'MGNREGS', 'MGNREGA Rural Employment', '2024-25', 28.00, 22.00, 18.50, 15500, 67.00, '[{"month":"Apr","allocated":28,"released":4,"utilized":3.0},{"month":"May","allocated":28,"released":9,"utilized":7.0},{"month":"Jun","allocated":28,"released":14,"utilized":11.0},{"month":"Jul","allocated":28,"released":18,"utilized":14.5},{"month":"Aug","allocated":28,"released":20,"utilized":16.5},{"month":"Sep","allocated":28,"released":22,"utilized":18.5},{"month":"Oct","allocated":28,"released":22,"utilized":18.5},{"month":"Nov","allocated":28,"released":22,"utilized":18.5},{"month":"Dec","allocated":28,"released":22,"utilized":18.5},{"month":"Jan","allocated":28,"released":22,"utilized":18.5},{"month":"Feb","allocated":28,"released":22,"utilized":18.5},{"month":"Mar","allocated":28,"released":22,"utilized":18.5}]'),

-- Jharkhand - Ranchi
('Jharkhand', 'Ranchi', 'PM-KISAN', 'Agriculture Support Scheme', '2024-25', 18.00, 15.00, 12.80, 9800, 76.00, '[{"month":"Apr","allocated":18,"released":3,"utilized":2.0},{"month":"May","allocated":18,"released":6,"utilized":4.5},{"month":"Jun","allocated":18,"released":9,"utilized":7.0},{"month":"Jul","allocated":18,"released":12,"utilized":9.5},{"month":"Aug","allocated":18,"released":13.5,"utilized":11.0},{"month":"Sep","allocated":18,"released":15,"utilized":12.8},{"month":"Oct","allocated":18,"released":15,"utilized":12.8},{"month":"Nov","allocated":18,"released":15,"utilized":12.8},{"month":"Dec","allocated":18,"released":15,"utilized":12.8},{"month":"Jan","allocated":18,"released":15,"utilized":12.8},{"month":"Feb","allocated":18,"released":15,"utilized":12.8},{"month":"Mar","allocated":18,"released":15,"utilized":12.8}]'),
('Jharkhand', 'Ranchi', 'MGNREGS', 'MGNREGA Rural Employment', '2024-25', 32.00, 28.00, 24.00, 18500, 81.00, '[{"month":"Apr","allocated":32,"released":5,"utilized":3.5},{"month":"May","allocated":32,"released":10,"utilized":8.0},{"month":"Jun","allocated":32,"released":16,"utilized":13.0},{"month":"Jul","allocated":32,"released":21,"utilized":17.5},{"month":"Aug","allocated":32,"released":25,"utilized":21.0},{"month":"Sep","allocated":32,"released":28,"utilized":24.0},{"month":"Oct","allocated":32,"released":28,"utilized":24.0},{"month":"Nov","allocated":32,"released":28,"utilized":24.0},{"month":"Dec","allocated":32,"released":28,"utilized":24.0},{"month":"Jan","allocated":32,"released":28,"utilized":24.0},{"month":"Feb","allocated":32,"released":28,"utilized":24.0},{"month":"Mar","allocated":32,"released":28,"utilized":24.0}]'),

-- West Bengal - Kolkata
('West Bengal', 'Kolkata', 'PM-JAY', 'Ayushman Bharat PM-JAY', '2024-25', 45.00, 40.00, 36.00, 32000, 88.00, '[{"month":"Apr","allocated":45,"released":8,"utilized":6.0},{"month":"May","allocated":45,"released":15,"utilized":12.0},{"month":"Jun","allocated":45,"released":22,"utilized":18.0},{"month":"Jul","allocated":45,"released":29,"utilized":24.0},{"month":"Aug","allocated":45,"released":35,"utilized":30.0},{"month":"Sep","allocated":45,"released":40,"utilized":36.0},{"month":"Oct","allocated":45,"released":40,"utilized":36.0},{"month":"Nov","allocated":45,"released":40,"utilized":36.0},{"month":"Dec","allocated":45,"released":40,"utilized":36.0},{"month":"Jan","allocated":45,"released":40,"utilized":36.0},{"month":"Feb","allocated":45,"released":40,"utilized":36.0},{"month":"Mar","allocated":45,"released":40,"utilized":36.0}]'),
('West Bengal', 'Kolkata', 'SSY', 'Sukanya Samriddhi Yojana', '2024-25', 12.00, 10.50, 9.80, 5600, 90.00, '[{"month":"Apr","allocated":12,"released":2,"utilized":1.5},{"month":"May","allocated":12,"released":4,"utilized":3.0},{"month":"Jun","allocated":12,"released":6,"utilized":5.0},{"month":"Jul","allocated":12,"released":8,"utilized":6.5},{"month":"Aug","allocated":12,"released":9.5,"utilized":8.5},{"month":"Sep","allocated":12,"released":10.5,"utilized":9.8},{"month":"Oct","allocated":12,"released":10.5,"utilized":9.8},{"month":"Nov","allocated":12,"released":10.5,"utilized":9.8},{"month":"Dec","allocated":12,"released":10.5,"utilized":9.8},{"month":"Jan","allocated":12,"released":10.5,"utilized":9.8},{"month":"Feb","allocated":12,"released":10.5,"utilized":9.8},{"month":"Mar","allocated":12,"released":10.5,"utilized":9.8}]'),

-- Uttar Pradesh - Lucknow
('Uttar Pradesh', 'Lucknow', 'PM-KISAN', 'Agriculture Support Scheme', '2024-25', 50.00, 42.00, 35.50, 28500, 78.00, '[{"month":"Apr","allocated":50,"released":8,"utilized":5.5},{"month":"May","allocated":50,"released":15,"utilized":11.0},{"month":"Jun","allocated":50,"released":22,"utilized":17.0},{"month":"Jul","allocated":50,"released":30,"utilized":23.5},{"month":"Aug","allocated":50,"released":36,"utilized":29.5},{"month":"Sep","allocated":50,"released":42,"utilized":35.5},{"month":"Oct","allocated":50,"released":42,"utilized":35.5},{"month":"Nov","allocated":50,"released":42,"utilized":35.5},{"month":"Dec","allocated":50,"released":42,"utilized":35.5},{"month":"Jan","allocated":50,"released":42,"utilized":35.5},{"month":"Feb","allocated":50,"released":42,"utilized":35.5},{"month":"Mar","allocated":50,"released":42,"utilized":35.5}]'),
('Uttar Pradesh', 'Lucknow', 'PMAY-G', 'PM Awaas Yojana Gramin', '2024-25', 40.00, 32.00, 8.50, 5600, 22.00, '[{"month":"Apr","allocated":40,"released":5,"utilized":1.0},{"month":"May","allocated":40,"released":10,"utilized":2.5},{"month":"Jun","allocated":40,"released":18,"utilized":4.0},{"month":"Jul","allocated":40,"released":25,"utilized":5.5},{"month":"Aug","allocated":40,"released":30,"utilized":7.0},{"month":"Sep","allocated":40,"released":32,"utilized":8.5},{"month":"Oct","allocated":40,"released":32,"utilized":8.5},{"month":"Nov","allocated":40,"released":32,"utilized":8.5},{"month":"Dec","allocated":40,"released":32,"utilized":8.5},{"month":"Jan","allocated":40,"released":32,"utilized":8.5},{"month":"Feb","allocated":40,"released":32,"utilized":8.5},{"month":"Mar","allocated":40,"released":32,"utilized":8.5}]'),
('Uttar Pradesh', 'Varanasi', 'PM-KISAN', 'Agriculture Support Scheme', '2024-25', 38.00, 35.00, 32.00, 24000, 91.00, '[{"month":"Apr","allocated":38,"released":7,"utilized":5.5},{"month":"May","allocated":38,"released":14,"utilized":11.0},{"month":"Jun","allocated":38,"released":20,"utilized":17.0},{"month":"Jul","allocated":38,"released":26,"utilized":22.0},{"month":"Aug","allocated":38,"released":31,"utilized":27.0},{"month":"Sep","allocated":38,"released":35,"utilized":32.0},{"month":"Oct","allocated":38,"released":35,"utilized":32.0},{"month":"Nov","allocated":38,"released":35,"utilized":32.0},{"month":"Dec","allocated":38,"released":35,"utilized":32.0},{"month":"Jan","allocated":38,"released":35,"utilized":32.0},{"month":"Feb","allocated":38,"released":35,"utilized":32.0},{"month":"Mar","allocated":38,"released":35,"utilized":32.0}]'),

-- Maharashtra - Pune
('Maharashtra', 'Pune', 'PMEGP', 'PM Employment Generation Programme', '2024-25', 28.00, 24.00, 21.50, 8400, 82.00, '[{"month":"Apr","allocated":28,"released":5,"utilized":3.5},{"month":"May","allocated":28,"released":9,"utilized":7.0},{"month":"Jun","allocated":28,"released":14,"utilized":11.0},{"month":"Jul","allocated":28,"released":18,"utilized":15.0},{"month":"Aug","allocated":28,"released":21,"utilized":18.0},{"month":"Sep","allocated":28,"released":24,"utilized":21.5},{"month":"Oct","allocated":28,"released":24,"utilized":21.5},{"month":"Nov","allocated":28,"released":24,"utilized":21.5},{"month":"Dec","allocated":28,"released":24,"utilized":21.5},{"month":"Jan","allocated":28,"released":24,"utilized":21.5},{"month":"Feb","allocated":28,"released":24,"utilized":21.5},{"month":"Mar","allocated":28,"released":24,"utilized":21.5}]'),
('Maharashtra', 'Pune', 'PM-JAY', 'Ayushman Bharat PM-JAY', '2024-25', 55.00, 48.00, 44.00, 42000, 87.00, '[{"month":"Apr","allocated":55,"released":9,"utilized":7.0},{"month":"May","allocated":55,"released":17,"utilized":14.0},{"month":"Jun","allocated":55,"released":25,"utilized":20.0},{"month":"Jul","allocated":55,"released":33,"utilized":28.0},{"month":"Aug","allocated":55,"released":40,"utilized":35.0},{"month":"Sep","allocated":55,"released":48,"utilized":44.0},{"month":"Oct","allocated":55,"released":48,"utilized":44.0},{"month":"Nov","allocated":55,"released":48,"utilized":44.0},{"month":"Dec","allocated":55,"released":48,"utilized":44.0},{"month":"Jan","allocated":55,"released":48,"utilized":44.0},{"month":"Feb","allocated":55,"released":48,"utilized":44.0},{"month":"Mar","allocated":55,"released":48,"utilized":44.0}]'),
('Maharashtra', 'Nagpur', 'MUDRA', 'MUDRA Yojana', '2024-25', 22.00, 18.00, 14.00, 11500, 65.00, '[{"month":"Apr","allocated":22,"released":3,"utilized":2.0},{"month":"May","allocated":22,"released":6,"utilized":4.5},{"month":"Jun","allocated":22,"released":10,"utilized":7.0},{"month":"Jul","allocated":22,"released":14,"utilized":10.0},{"month":"Aug","allocated":22,"released":16,"utilized":12.0},{"month":"Sep","allocated":22,"released":18,"utilized":14.0},{"month":"Oct","allocated":22,"released":18,"utilized":14.0},{"month":"Nov","allocated":22,"released":18,"utilized":14.0},{"month":"Dec","allocated":22,"released":18,"utilized":14.0},{"month":"Jan","allocated":22,"released":18,"utilized":14.0},{"month":"Feb","allocated":22,"released":18,"utilized":14.0},{"month":"Mar","allocated":22,"released":18,"utilized":14.0}]');

-- =============================
-- SEED: NEWS & UPDATES
-- =============================
INSERT INTO public.news_updates (title, body, category, published_at) VALUES
('PM-KISAN 17th Installment Released', 'The 17th installment of PM-Kisan Samman Nidhi has been released. Over 9.5 crore farmers across India will receive ₹2,000 each directly in their bank accounts. [Demo Data]', 'Agriculture', NOW() - INTERVAL '2 days'),
('Ayushman Bharat Expanded to Include 70+ Citizens', 'The Ayushman Bharat PM-JAY scheme has been expanded to cover all citizens above 70 years regardless of income. This adds 6 crore senior citizens to the scheme. [Demo Data]', 'Health', NOW() - INTERVAL '5 days'),
('PMAY-G Target Revised Upwards for 2024-25', 'The Ministry of Rural Development has revised the Pradhan Mantri Awaas Yojana (Gramin) target upward by 20% for 2024-25, aiming to cover an additional 30 lakh households. [Demo Data]', 'Housing', NOW() - INTERVAL '10 days'),
('MGNREGA Wage Rates Revised', 'The Ministry of Rural Development has revised MGNREGA wage rates for all states. Assam wage rate revised to ₹249/day, Bihar to ₹237/day, effective April 2024. [Demo Data]', 'Rural Development', NOW() - INTERVAL '15 days'),
('National Scholarship Portal Applications Open 2024-25', 'Applications for pre-matric and post-matric scholarships on the National Scholarship Portal are now open. Eligible students should apply before the deadline. [Demo Data]', 'Education', NOW() - INTERVAL '20 days'),
('GrantTrack Gov Fund Utilization Review Q2 2024-25', 'Q2 fund utilization review shows 73% average utilization across monitored schemes. Districts with below 40% utilization have been flagged for administrative review. [Demo Data]', 'Governance', NOW() - INTERVAL '7 days');
