# Planificador PVPC

App web estatica para consultar el precio horario PVPC y localizar franjas
baratas para programar consumos como la carga de un coche electrico, lavadora o
lavavajillas.

## Funciones

- Consulta por fecha con acceso rapido a hoy y manana.
- Seleccion de zona PVPC `PCB` o `CYM`.
- Tres vistas graficas: curva horaria, barras comparativas y mapa de oportunidad.
- Tabla completa de tramos horarios en `EUR/kWh`.
- Calculadora de la mejor ventana continua por duracion y consumo estimado.
- Compatible con PWA: se puede instalar desde Chrome en Android cuando se sirve
  por HTTPS o desde `localhost`.

## Datos

La app consulta el archivo diario JSON de eSIOS:

```text
https://api.esios.ree.es/archives/70/download_json
```

El archivo devuelve precios PVPC en `EUR/MWh`; la interfaz los convierte a
`EUR/kWh`.

## Arranque local

Desde esta carpeta:

```bash
python3 -m http.server 4173
```

Despues abre `http://localhost:4173`.

## Instalacion como app en Android

1. Publica la carpeta en un hosting con HTTPS, por ejemplo GitHub Pages,
   Netlify, Vercel o similar.
2. Abre la URL desde Chrome en Android.
3. Usa el menu de Chrome y elige `Instalar app` o `Anadir a pantalla de inicio`.

En local tambien puedes comprobar el comportamiento PWA con el servidor anterior
porque los navegadores tratan `localhost` como origen seguro.
