-- =============================================
-- Update function to generate incident code
-- OLD Format: INC-YYYYMMDD-XXXX (e.g., INC-20260429-0001)
-- NEW Format: INC-YYYY-XXXX (e.g., INC-2026-0001)
-- Number resets to 0001 every year
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_incident_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_year TEXT;
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- Get current year in YYYY format
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(i.incident_code FROM 'INC-[0-9]{4}-([0-9]{4})') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.incidents i
  WHERE i.incident_code LIKE 'INC-' || current_year || '-%';
  
  -- Generate the incident code: INC-YYYY-XXXX
  new_code := 'INC-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_code;
END;
$$;

-- Update comment
COMMENT ON FUNCTION public.generate_incident_code() IS 'Generates a unique incident code in format INC-YYYY-XXXX. Number resets to 0001 every year.';

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- Examples:
-- - 2026: INC-2026-0001, INC-2026-0002, ..., INC-2026-9999
-- - 2027: INC-2027-0001, INC-2027-0002, ... (resets to 0001)
