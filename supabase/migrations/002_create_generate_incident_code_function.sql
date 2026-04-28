-- =============================================
-- Create function to generate incident code
-- Format: INC-YYYYMMDD-XXXX (e.g., INC-20250128-0001)
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_incident_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_date TEXT;
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- Get today's date in YYYYMMDD format
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(i.incident_code FROM 'INC-[0-9]{8}-([0-9]{4})') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.incidents i
  WHERE i.incident_code LIKE 'INC-' || today_date || '-%';
  
  -- Generate the incident code
  new_code := 'INC-' || today_date || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_code;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_incident_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_incident_code() TO anon;

-- Add comment
COMMENT ON FUNCTION public.generate_incident_code() IS 'Generates a unique incident code in format INC-YYYYMMDD-XXXX';
