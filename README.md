# Printable Maze Generator

Local, Offline, Print-First

## What This Is

A small, intentionally constrained web app that generates printable maze packs for kids. Built for parents first; structured to be inspectable and testable by engineers.

## Why It Exists

- Kids finish Highlights mazes before the magazine is done
- Parents want fast, printable activities
- Generative systems are best demonstrated with real constraints

## Key Design Choices

- Print-first UX (PDF, margins, B/W)
- Perfect mazes only (predictable difficulty)
- No persistence (lower complexity, faster iteration)
- Local-only (privacy, longevity)

## How It Works (High Level)

1. Parameters → maze generator
2. Generator produces perfect maze
3. Solver validates path
4. Renderer produces PDF page
5. Pages bundled into single PDF

## Debug Mode

A hidden mode that exposes:

- Why it exists
- What parameters are available
- How solver validation works

## Tech Stack

- Lightweight local server
- Deterministic maze generation
- PDF rendering pipeline

## License

- Free for personal use
- Non-commercial
- Attribution encouraged

## Author

Nik Chaphalkar  
[makernik.com](https://makernik.com)
