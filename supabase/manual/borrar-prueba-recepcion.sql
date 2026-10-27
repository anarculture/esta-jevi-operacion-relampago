-- Borra las órdenes de prueba del recepcionista de vytas (aprobada y en revisión) y sus entradas.
-- Solo toca referencias PRUEBARECEPCION…; la última línea debe imprimir 0.
delete from entradas where orden_id in (select id from ordenes where referencia like 'PRUEBARECEPCION%');
delete from ordenes where referencia like 'PRUEBARECEPCION%';
select count(*) from ordenes where referencia like 'PRUEBARECEPCION%';
