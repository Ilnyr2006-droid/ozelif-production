ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN (
    'owner',
    'catalog_manager',
    'chat_manager',
    'content_editor',
    'viewer'
  ));
