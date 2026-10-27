-- Borra la orden de prueba del check-in (orden-prueba-portero.sql): la orden, sus entradas y la
-- lectura de su captura. Solo toca referencias PRUEBAPORTERO…; la última línea debe imprimir 0.
delete from lecturas where path in (select captura from ordenes where referencia like 'PRUEBAPORTERO%');
delete from entradas where orden_id in (select id from ordenes where referencia like 'PRUEBAPORTERO%');
delete from ordenes where referencia like 'PRUEBAPORTERO%';
select count(*) from ordenes where referencia like 'PRUEBAPORTERO%';
