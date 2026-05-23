# personal-workspace

个人工作台第一版：笔记、主机管理、项目管理和链接中心。

## Tech Stack

- Java 11
- Spring Boot 2.7.x
- React + TypeScript + Vite
- Tailwind CSS
- lucide-react

## Development

Backend:

```powershell
mvn spring-boot:run
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Production-style frontend build:

```powershell
cd frontend
npm install
npm run build
cd ..
mvn spring-boot:run
```

The frontend build writes to `src/main/resources/static`, so Spring Boot can serve the app directly.
