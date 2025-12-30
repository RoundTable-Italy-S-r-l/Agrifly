
Controllo ruolo utente nel database:

SELECT 
  om.role as membership_role, 
  om.is_active,
  o.type as org_type,
  o.legal_name
FROM org_memberships om 
JOIN organizations o ON om.org_id = o.id 
WHERE om.user_id = 'cmjcki79j0000cb9txi71izcl' 
AND om.is_active = true;

