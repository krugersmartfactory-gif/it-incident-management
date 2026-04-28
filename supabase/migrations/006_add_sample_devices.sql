-- =============================================
-- Add sample devices data
-- =============================================

-- Insert sample devices (thay đổi theo thiết bị thực tế của bạn)
INSERT INTO public.devices (device_code, device_name, device_type, location, purchase_date, status) VALUES
('TH141', 'Máy tính TH141', 'Computer', 'Phòng IT', '2024-01-01', 'Active'),
('PC001', 'Máy tính PC001', 'Computer', 'Phòng Kế toán', '2024-01-01', 'Active'),
('PC002', 'Máy tính PC002', 'Computer', 'Phòng Nhân sự', '2024-01-01', 'Active'),
('PRINTER-01', 'Máy in HP LaserJet', 'Printer', 'Phòng Hành chính', '2024-01-01', 'Active'),
('PROJECTOR-01', 'Máy chiếu Epson', 'Projector', 'Phòng họp A', '2024-01-01', 'Active')
ON CONFLICT (device_code) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.devices IS 'Danh sách thiết bị trong hệ thống';
