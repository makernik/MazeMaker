# Theme images (corner decorations)

The app draws **one image per corner** of the printable area (in the margin only, never inside the maze). Place PNG or JPG files here so the app can load them at runtime. Use any **internet-available icon or line-art pack** you like; filenames must match exactly.

## Shapes (`public/themes/shapes/`)

Required filenames (one per corner, then repeated):

- `triangle.png`
- `circle.png`
- `square.png`
- `rectangle.png`
- `rhombus.png`
- `parallelogram.png`
- `pentagon.png`
- `star.png`
- `heart.png`
- `torus.png`

## Animals (`public/themes/animals/`)

Required filenames:

- `dog.png`
- `cat.png`
- `duck.png`
- `bear.png`
- `fox.png`
- `butterfly.png`

If a file is missing, that corner is simply left undecorated (no error). Black-and-white or line-art images work best for the printable style.
