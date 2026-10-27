-- Borra la compra de prueba del cotejo (issues #6 y #7, ticket 04): la orden, sus entradas y la
-- lectura de su captura. Solo toca referencias PRUEBACOTEJO…; la última línea debe imprimir 0.
delete from lecturas where path in (select captura from ordenes where referencia like 'PRUEBACOTEJO%');
delete from entradas where orden_id in (select id from ordenes where referencia like 'PRUEBACOTEJO%');
delete from ordenes where referencia like 'PRUEBACOTEJO%';
select count(*) from ordenes where referencia like 'PRUEBACOTEJO%';
