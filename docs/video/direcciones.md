# Direcciones — reel Sindicato Baba (Interact, 27-oct-2026)

Intel (`intel.md`) × Inspo (`inspo.md`) → tres direcciones sobre el mismo esqueleto. Mau elige una.

## Esqueleto común (18 s, 9:16)

Duraciones a ~135 bpm (compás ≈ 1,8 s), a ajustar al track real. Todo el texto es capa tipográfica
encima: la IA no dibuja letras (`inspo.md`, Evitar).

| t (s) | Bloque | En pantalla | Por qué |
|---|---|---|---|
| 0–1,5 | Gancho | **DJ BABATR** en cromo desde el cuadro 1 | Intel 3; Inspo 1 |
| 1,5–4 | Credencial | **EL CREADOR DEL RAPTOR HOUSE** (alternativa: DE BERGHAIN A CHACAÍTO) | Intel 1 |
| 4–9 | Mundo | varía por dirección; "ruido para bailar" opcional | Inspo 2–4 |
| 9–10,5 | Lineup en ráfaga | amesty · miss vzla & warapo · lis the producer · giulio tafa, uno por golpe | Intel 8; Inspo 5 |
| 10,5–13 | Datos, quietos | **JUEVES 29 OCT · 21:00 · CC CHACAÍTO** | Intel 6 |
| 13–18 | CTA, quieto ≥ 4 s | **PREVENTA $10 · PUERTA $15** / LINK EN BIO / postropicalia.com/sindicato-baba / pago móvil · Zelle · Binance · entrada con QR / logos Zulia, Bandera, Mal Portada / @SINDICATO.CLUB en verde | Intel 4–5; Inspo 7–8 |

Fuera del montaje y con más peso que él: **publicar como Collab con @djbabatr** (38K contra 418; Intel 2).

## A · Cromo vivo

Una masa de cromo líquido muta en cada golpe, refleja el horizonte de cables y se condensa en las letras
de BABATR en el drop; en "Mundo" gotea sobre los cables fotocopiados.

- Elementos nuevos: 3 clips de cromo líquido sobre negro (Seedance 2.5, 4 s c/u). El aterrizaje en
  letras se compone con el recorte de cromo del flyer (`elements/_trabajo/title_isnet-general-use.png`).
- Costo: el cromo pide 1080p (los reflejos se ven a 480p) → 3 × 4 s × 16 cr = 192 cr, ~250 con
  reintentos. **No cabe en los 83 cr actuales.** Alternativa local: metaballs en Blender, 0 cr y ~3 h,
  riesgo alto de que se vea 3D de stock.
- Riesgo: medio. El morph cromo→letras es el plano que más falla.

## B · Cables cargados (recomendada)

Los cables de Caracas son el protagonista: vibran con el bajo, una chispa corre por ellos y "carga" las
letras de cromo, que destellan con estrellas de cuatro puntas. Fotocopia que hierve cuadro a cuadro y
cambia de tinte en cada compás (azul → lima → magenta, los tintes del colectivo).

- Elementos nuevos: 3–4 clips image-to-video desde las fotocopias de cables que ya existen
  (`elements/1.png`, `3.png`, `4.png`): cables que se mecen, cámara que sube por el poste, chispa que
  recorre el tendido. Post en ffmpeg/Python: umbral + ruido con semilla nueva por cuadro, tinte por compás,
  letras de cromo del flyer con destellos.
- Costo: la fotocopia destruye el detalle, así que basta 480p → 4 × 4 s × 3 cr = 48 cr, ~65 con un
  reintento. **Cabe en los 83 cr.**
- Riesgo: bajo. Es el ADN del flyer (Inspo 3, 4, 8: Dekmantel "cable y agua", Up To Date, COREspecs).

## C · La fotocopiadora del poste

El reel es una fotocopiadora: en cada golpe pasa la barra de luz del escáner y sale una hoja nueva
(BABATR, credencial, lineup, datos). Cierra con la hoja final pegada en un poste de Chacaíto de noche.

- Elementos nuevos: hojas y escáner hechos en local (gráfica en Python/HyperFrames); 1–2 clips del poste
  de noche con papel en blanco (720p), sobre el que se compone la hoja del CTA con cámara fija.
- Costo: 2 × 4 s × ~8 cr ≈ 64 cr. Cabe justo, sin margen para reintentos.
- Riesgo: medio. Si el poste generado no se lee como Caracas, el cierre pierde lo local.

## Revisión con frameworks (SUCCESs de *Made to Stick*, Cialdini de *Influence*)

- **Simple:** un solo mensaje: BABATR en Chacaíto el jueves, $10. Nada de grilla horaria.
- **Inesperado:** A y B rompen el patrón de plantilla de club (Inspo, Evitar); C rompe por concepto.
- **Concreto y creíble:** fecha, lugar, precio, URL y métodos de pago; credencial con fuente (Berghain,
  Boiler Room); "entrada con QR" + aliados para quien le paga a un desconocido.
- **Emocional:** el que salió de los barrios de Caracas y toca en Berghain vuelve a tocar aquí.
  La credencial alternativa "DE BERGHAIN A CHACAÍTO" lo dice en cuatro palabras.
- **Escasez:** solo la verdadera: $10 hoy contra $15 en puerta. "Quedan pocas" no, salvo que sea cierto.
- **Autoridad y prueba social:** credencial + Collab con @djbabatr + logos de aliados.

## Decisiones de Mau

1. Dirección: A, B o C (o B con algo de otra).
2. Créditos: B cabe en los 83 actuales; A necesita recarga (~250).
3. Audio: qué track (Intel 7 propone "Xtasis" o el Boiler Room Caracas) y el archivo para cortar al golpe.
   Si va con música de la biblioteca de Instagram al subir, el corte se hace al bpm y se alinea a mano.
4. Credencial: "EL CREADOR DEL RAPTOR HOUSE" o "DE BERGHAIN A CHACAÍTO".
5. Collab: quién le escribe a @djbabatr.
