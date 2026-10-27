---
name: Sindicato Baba
description: Fotocopia en el poste — tóner negro, grises de fotocopiadora y un solo verde neón, con componentes que se sienten nativos de iOS.
colors:
  toner-negro: "#0f0f0f"
  toner-carbon: "#1a1a1a"
  toner-grafito: "#262626"
  linea-fotocopia: "#2f3440"
  gris-fotocopia: "#8c9fc6"
  papel: "#f2f2f2"
  verde-neon: "#2ed847"
  verde-neon-tinta: "#0b3d17"
  rojo-aviso: "#ff5a50"
  rojo-aviso-tinta: "#3a1210"
  amarillo-marcador: "#ffd60a"
  amarillo-marcador-tinta: "#3d3200"
  qr-blanco: "#ffffff"
typography:
  display:
    fontFamily: "Oswald, Impact, 'Arial Narrow', sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Oswald, Impact, 'Arial Narrow', sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.35
  secondary:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
  monto:
    fontFamily: "Oswald, Impact, 'Arial Narrow', sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
    fontVariation: "tabular-nums"
rounded:
  pill: "999px"
  card: "12px"
  control: "10px"
  qr: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.verde-neon}"
    textColor: "{colors.toner-negro}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "50px"
  button-primary-pressed:
    backgroundColor: "#26b83c"
    textColor: "{colors.toner-negro}"
  button-tonal:
    backgroundColor: "{colors.toner-grafito}"
    textColor: "{colors.verde-neon}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "50px"
  button-destructive:
    backgroundColor: "{colors.toner-grafito}"
    textColor: "{colors.rojo-aviso}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "50px"
  button-copiar:
    backgroundColor: "{colors.toner-grafito}"
    textColor: "{colors.verde-neon}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.toner-carbon}"
    textColor: "{colors.papel}"
    rounded: "{rounded.card}"
    padding: "16px"
  input:
    backgroundColor: "{colors.toner-grafito}"
    textColor: "{colors.papel}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "48px"
  chip-estado:
    backgroundColor: "{colors.amarillo-marcador-tinta}"
    textColor: "{colors.amarillo-marcador}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  chip-estado-ok:
    backgroundColor: "{colors.verde-neon-tinta}"
    textColor: "{colors.verde-neon}"
  chip-estado-mal:
    backgroundColor: "{colors.rojo-aviso-tinta}"
    textColor: "{colors.rojo-aviso}"
  qr-marco:
    backgroundColor: "{colors.qr-blanco}"
    textColor: "{colors.toner-negro}"
    rounded: "{rounded.qr}"
    padding: "16px"
---

<!-- MUNDO ELEGIDO el 26-oct-2026 con Mau, antes de implementarse en ticketera/t.css. Los tokens son la decisión, no una extracción. Vuelve a correr $impeccable document cuando el CSS lo aplique, para capturar lo que de verdad quedó. -->

# Design System: Sindicato Baba

## Overview

**Creative North Star: "Fotocopia en el poste"**

El flyer de la fiesta es una fotocopia pegada en la calle: cables, fachada, tóner negro que se come
los medios tonos, un gris azulado de fotocopiadora y una sola cosa a color, el handle en verde
neón. El sistema vive dentro de esa hoja. El fondo es tóner, no "modo oscuro": negro casi puro,
sin azules de interfaz. El texto es papel. Todo lo que se puede tocar o que confirma algo es verde
neón, y nada más lo es.

Debajo de esa piel, los componentes se comportan como iOS: listas agrupadas por capas tonales,
botones rellenos de 50 px, campos con fondo propio, radios de 10 a 12 px, tipografía del sistema a
17 px y objetivos de 44 px. El comprador reconoce el gesto aunque la hoja sea de otro mundo. El
cromo de las letras del flyer no se imita en la interfaz: lo reemplaza una condensada de cartel,
en mayúsculas, que lee como afiche. El grano de fotocopia existe, pero solo en la cabecera y en el
marco del QR; las tarjetas, las listas y los formularios son planos.

**Key Characteristics:**
- Tóner negro como ground, papel como texto, un solo acento neón.
- Capas tonales en vez de bordes y sombras (negro → carbón → grafito).
- Display condensada en mayúsculas; cuerpo en tipografía del sistema (HIG).
- Grano de fotocopia confinado a cabecera y QR.
- El QR siempre negro sobre blanco, dentro de un marco papel.

## Colors

Tóner, papel y un neón: la paleta de una fotocopia con un marcador encima.

### Primary
- **Verde neón** (#2ed847): el único color. Botón principal, enlaces, estado aprobado, chip de la
  IA cuando coincide, anillo de foco. Sale del handle `@SINDICATO.CLUB` del flyer.
- **Verde neón tinta** (#0b3d17): fondo de chips y bandas que llevan texto verde neón.

### Neutral
- **Tóner negro** (#0f0f0f): fondo de página.
- **Tóner carbón** (#1a1a1a): tarjetas y filas de lista agrupada.
- **Tóner grafito** (#262626): campos, botones tonales, segunda capa dentro de una tarjeta.
- **Línea fotocopia** (#2f3440): separadores entre filas de lista.
- **Gris fotocopia** (#8c9fc6): texto secundario, etiquetas, metadatos. Es el gris azulado de los
  medios tonos del flyer; nunca se usa para texto largo.
- **Papel** (#f2f2f2): texto principal y títulos. No es blanco puro: es papel fotocopiado.
- **QR blanco** (#ffffff): solo el marco del QR, por la lectura del escáner.

### Semantic
- **Rojo aviso** (#ff5a50) sobre **rojo aviso tinta** (#3a1210): rechazo, error de campo, botón
  destructivo. Es el rojo de sistema de iOS en oscuro, aclarado hasta pasar 4,5:1 sobre grafito.
- **Amarillo marcador** (#ffd60a) sobre **amarillo marcador tinta** (#3d3200): en revisión, dudoso,
  avisos de "haz captura ahora".

### Named Rules
**The One Neon Rule.** El verde neón es el único color de acción. Si dos cosas de una pantalla
compiten por él, una de las dos pasa a tonal. Nunca se usa de fondo de superficie grande.

**The Paper Text Rule.** El texto principal es papel (#f2f2f2) sobre tóner; el gris fotocopia
solo lleva texto corto y secundario. Contraste mínimo 4,5:1 en todos los pares.

## Typography

**Display Font:** Oswald 700/600 (con Impact, Arial Narrow)
**Body Font:** system-ui (SF Pro en iOS, Roboto en Android, Segoe en Windows)

**Character:** afiche de calle arriba, sistema operativo abajo. La condensada en mayúsculas da el
golpe del nombre, la fecha y el monto; todo lo que se lee o se llena va en la tipografía del
teléfono, a los tamaños que el HIG ya enseñó a la gente.

### Hierarchy
- **Display** (Oswald 700, 34px, 1.05, mayúsculas): nombre de la fiesta y "Orden #12". Uno por pantalla.
- **Headline** (Oswald 600, 22px, 1.15, mayúsculas): títulos de paso ("1. ¿Cuántas y cómo pagas?") y secciones del panel.
- **Monto** (Oswald 700, 40px, tabular): la cifra a pagar. Es el elemento más grande después del display.
- **Title** (system-ui 600, 17px): texto de botones, nombre en tarjetas, etiquetas de datos destacados.
- **Body** (system-ui 400, 17px, 1.35): párrafos, filas de lista, campos. Largo máximo 60ch.
- **Secondary** (system-ui 400, 15px): metadatos, línea de tasa, ayuda bajo un campo.
- **Label** (system-ui 600, 13px, 0.02em): etiquetas de campo, chips de estado, "Código de respaldo".

### Named Rules
**The Street Poster Rule.** Oswald solo en mayúsculas y solo en display, headline y monto. Nunca
en párrafos, botones ni campos.

## Layout

Una columna de 390 px con márgenes de 16 px (HIG). Ritmo de 8: 4 / 8 / 16 / 24 / 32. Las
tarjetas van a sangre con el margen, separadas 16 px entre sí; dentro, 16 px de padding. Las filas
de lista agrupada miden 44 px como mínimo y se separan con una línea fotocopia con inset de 16 px
a la izquierda. El botón principal de cada pantalla va al final del bloque que lo necesita, no
flotando. En pantallas más anchas la columna se centra con un máximo de 34rem; no hay grilla de
varias columnas en esta fiesta.

## Elevation & Depth

Sin sombras. La profundidad es tonal, como las capas de una fotocopia: tóner negro (página) →
carbón (tarjeta) → grafito (campo o botón tonal dentro de la tarjeta). Un elemento más cerca es
un paso más claro, nunca un paso con sombra. El estado presionado de un botón oscurece el relleno
un 15 %; el foco de teclado es un anillo de 3 px verde neón con 2 px de separación.

### Named Rules
**The Three Toners Rule.** Tres capas y no más: negro, carbón, grafito. Si hace falta una cuarta,
el componente está mal anidado.

## Shapes

Esquinas de iOS: 12 px en tarjetas, 10 px en botones y campos, 16 px en el marco del QR, píldora
en chips. Sin bordes en tarjetas (la capa tonal las separa); sin borde en campos en reposo (el
relleno grafito sobre carbón los identifica, como en iOS); 2 px verde neón al enfocar y rojo aviso con error. El grano de
fotocopia es una textura monocroma al 8 % que se superpone solo a la cabecera (el flyer) y al
marco del QR; nunca sobre texto ni campos.

## Components

### Buttons
- **Shape:** rectángulo de esquinas redondeadas (10px), 50 px de alto, ancho completo cuando es la acción de la pantalla.
- **Primary:** verde neón con texto tóner negro, system-ui 600 17px. Presionado: #26b83c.
- **Tonal (secundario):** grafito con texto verde neón. Para "Copiar enlace", "Recargar", "Enviar por WhatsApp" cuando no es la acción principal.
- **Destructive:** grafito con texto rojo aviso ("Rechazar", "Resolverlo por WhatsApp" en un rechazo). Nunca relleno rojo.
- **Copiar:** píldora de 36 px, grafito con texto verde neón, label 13px. Al copiar pasa a verde neón tinta con texto "Copiado" dos segundos.
- **Focus:** anillo 3 px verde neón, offset 2 px.

### Chips (estado)
- **Style:** píldora, label 13px 600, fondo tinta y texto del color semántico.
- **State:** en revisión / dudoso / IA pendiente = amarillo marcador; aprobada / coincide = verde neón; rechazada / no coincide = rojo aviso.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** carbón sobre página negra; grafito para una segunda capa interna.
- **Shadow Strategy:** ninguna; ver Elevation.
- **Border:** ninguno.
- **Internal Padding:** 16px; 8px entre filas internas.

### Inputs / Fields
- **Style:** grafito, 48 px, radio 10px, sin borde en reposo, texto papel 17px; etiqueta label 13px gris fotocopia encima, 4 px de separación.
- **Focus:** borde 2px verde neón.
- **Error:** borde rojo aviso + mensaje secondary 15px rojo aviso debajo, `aria-invalid`.
- **Opciones (radio de método):** fila de lista de 56 px en carbón; la elegida pasa a grafito con borde 2px verde neón y un check verde a la derecha.

### Navigation
No hay navegación entre secciones: cada página es una tarea. La vuelta es el enlace "Ver mi orden"
en la compra y los botones de WhatsApp. En el panel admin, la búsqueda es un campo de 48 px bajo
el título, estilo barra de búsqueda de iOS.

### Cabecera (signature)
Imagen del flyer recortada 1080×480 a sangre con el margen, esquinas 12px, grano al 8 %, y debajo
el display en Oswald con la línea de fecha y lugar en title. Es la única pieza con foto.

### Marco de QR (signature)
Tarjeta blanca pura de 16px de radio con 16 px de padding, grano al 8 % en el borde exterior, QR
negro a 280 px, "Entrada N de M" en title tóner negro arriba y "Código de respaldo" en label gris
debajo. Es la única superficie clara del sistema, a propósito: el escáner la necesita.

## Do's and Don'ts

### Do:
- **Do** usar verde neón (#2ed847) solo para acción, enlace, foco y aprobado.
- **Do** separar capas por tono (negro → carbón → grafito), nunca por sombra ni borde.
- **Do** mantener el QR negro sobre blanco puro dentro de su marco.
- **Do** escribir display, headline y monto en Oswald mayúsculas; todo lo demás en system-ui a 17/15/13.
- **Do** respetar 44 px de objetivo táctil y 16 px de margen lateral.

### Don't:
- **Don't** usar blanco puro como texto o fondo fuera del marco del QR; el texto es papel (#f2f2f2).
- **Don't** meter grano detrás de texto, campos o tarjetas.
- **Don't** rellenar un botón de rojo; destructivo es texto rojo sobre grafito.
- **Don't** imitar el cromo del flyer con degradados o efectos metálicos en la interfaz.
- **Don't** añadir un segundo color de acento (ni el verde #1f6f4a de la plataforma de PM).
