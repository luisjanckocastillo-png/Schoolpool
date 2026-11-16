# SchoolPool

Aplicación web para organizar una salida educativa. Permite que los estudiantes consulten los lugares que van a visitar, los ubiquen en un mapa interactivo, lean información de cada sitio y registren las actividades realizadas.

## Tecnologías

- **HTML, CSS y JavaScript:** interfaz web adaptable a computadoras y celulares.
- **Supabase Auth:** registro, inicio y cierre de sesión.
- **Supabase Database + RLS:** datos compartidos y permisos por usuario/rol.
- **OpenStreetMap + Leaflet:** mapa interactivo y marcadores de lugares.
- **GitHub:** repositorio del código.
- **Cloudflare Pages:** publicación del sitio web.

No se utiliza FlutterFlow: la interfaz se desarrolló directamente con HTML, CSS y JavaScript.

## Funciones incluidas

1. Registro e inicio de sesión de estudiantes.
2. Resumen de la salida educativa y sus paradas.
3. Catálogo de lugares con búsqueda y filtro por categoría.
4. Mapa interactivo con marcadores seleccionables.
5. Ficha de cada lugar con descripción, dirección, imagen opcional y enlace externo.
6. Actividades generales o asociadas a un lugar.
7. Registro personal de actividades completadas y observaciones.
8. Pantalla de progreso del estudiante.
9. Panel de administración para crear lugares y actividades.
10. Diseño adaptable a celular y computadora.

## Estructura de datos en Supabase

| Tabla | Función |
|---|---|
| `profiles` | Perfil y rol del usuario. |
| `trips` | Salidas educativas. |
| `places` | Lugares con coordenadas geográficas. |
| `trip_places` | Relación entre salidas y lugares, con orden de visita. |
| `activities` | Actividades asociadas a una salida y opcionalmente a un lugar. |
| `completions` | Registro de actividades completadas por cada estudiante. |

Las seis tablas tienen RLS activado. Los estudiantes consultan las salidas publicadas y los lugares/actividades; cada estudiante solo puede consultar y modificar sus propios registros. Las operaciones de administración requieren el rol `admin`.

## Datos de demostración

Se crea una salida de ejemplo con cuatro lugares de Buenos Aires: Cabildo, Museo Histórico Nacional, Reserva Ecológica Costanera Sur y Planetario Galileo Galilei. Son datos ilustrativos para probar la aplicación; se pueden reemplazar por los lugares reales de la salida.

## Configuración de la cuenta administradora

1. Registrá tu cuenta desde la aplicación.
2. Confirmá el correo si Supabase tiene habilitada la confirmación por email.
3. En Supabase abrí **SQL Editor** y ejecutá esta consulta, reemplazando el correo por el que usaste al registrarte:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'TU_CORREO@EJEMPLO.COM'
);
```

4. Cerrá sesión y volvé a ingresar. Vas a ver la sección **Administración**.

El rol no se puede modificar desde el formulario de perfil: solo se cambia desde el panel SQL de Supabase.

## Publicar en Cloudflare Pages

1. Entrá a Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Elegí el repositorio `luisjanckocastillo-png/Schoolpool` y la rama `main`.
3. Configurá:
   - Framework preset: **None**.
   - Build command: dejar vacío.
   - Build output directory: `/` o `.` (directorio raíz del repositorio, según la interfaz).
4. Guardá y desplegá.

Es un sitio estático: no requiere Node.js, compilación ni variables secretas del lado de Cloudflare. Si Cloudflare pide variables de entorno, no hace falta agregar ninguna para esta versión.

## Seguridad

- El navegador utiliza únicamente la clave **publishable** de Supabase, que está diseñada para clientes públicos.
- Nunca colocar una clave `service_role` o una clave secreta en `script.js`.
- RLS está habilitado en todas las tablas expuestas.
- Las políticas limitan los registros personales a su propietario y reservan la gestión de contenido al rol administrador.

## OpenStreetMap

El mapa utiliza Leaflet y los mosaicos estándar de OpenStreetMap. Se muestra la atribución correspondiente en el mapa. El servicio estándar de mosaicos es comunitario: respetá su política de uso, no hagas descargas masivas ni precargues mapas para uso sin conexión. Las coordenadas se guardan en Supabase; el mapa solo las representa.

- [OpenStreetMap Copyright](https://www.openstreetmap.org/copyright)
- [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)

## Archivos principales

- `index.html`: estructura y pantallas.
- `style.css`: diseño adaptable.
- `script.js`: autenticación, consultas, registros y mapas.
