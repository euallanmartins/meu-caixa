-- Ambiente atual de testes: uma unica barbearia publica.
-- O multi-tenant continua preservado pelo barbearia_id em todas as tabelas.

UPDATE public.barbearias
SET nome = 'dsbarbershop'
WHERE id = 'a251aedd-347a-466a-a26a-4b53d394f7ae';
