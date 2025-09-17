-- 20250903_create_audit_view.sql
-- View to join audit logs with user names
CREATE OR REPLACE VIEW public.vw_system_audit_logs AS
SELECT
  sal.id,
  sal.action AS event_type,
  sal.details,
  sal.performed_by AS user_id,
  sal.profile_id,
  p.first_name,
  p.last_name,
  sal.timestamp
FROM public.system_audit_logs sal
LEFT JOIN public.profiles p ON p.id = sal.profile_id
ORDER BY sal.timestamp DESC;
