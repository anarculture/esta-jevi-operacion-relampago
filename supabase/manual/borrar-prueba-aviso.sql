-- Borra la orden de prueba del aviso por vytas (issue #5, ticket 05) y sus entradas.
-- Solo toca referencias PRUEBAAVISO…; la última línea debe imprimir 0.
delete from entradas where orden_id in (select id from ordenes where referencia like 'PRUEBAAVISO%');
delete from ordenes where referencia like 'PRUEBAAVISO%';
select count(*) from ordenes where referencia like 'PRUEBAAVISO%';
