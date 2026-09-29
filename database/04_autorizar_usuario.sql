-- Supabase > Authentication > Users > Add user. Crie a conta corporativa.
-- Copie seu UUID; substitua abaixo ANTES de executar. Email/senha ficam no Supabase.
INSERT INTO montekali.acessos(usuario,loja_codigo,papel)
VALUES ('COLE-O-UUID-DO-USUARIO'::uuid,'007','importador')
ON CONFLICT (usuario,loja_codigo) DO UPDATE SET papel=excluded.papel;
-- Outros usuarios: use papel 'consulta' para acesso somente leitura.
