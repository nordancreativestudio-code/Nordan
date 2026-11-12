-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · migração 0004 · agendamento da paragem automática (pg_cron, dentro do Supabase)
-- Corre public.parar_esquecidos() de 5 em 5 minutos. Não usa a Vercel.
-- Se o "create extension" falhar, ativa pg_cron em Database → Extensions e volta a correr.
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job where jobname = 'parar-cronometros-esquecidos';
select cron.schedule('parar-cronometros-esquecidos', '*/5 * * * *', $$select public.parar_esquecidos()$$);
