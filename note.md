| You know from before        | Web world equivalent                                  |
| --------------------------- | ----------------------------------------------------- |
| `Python`                    | `JavaScript`                                          |
| `pip install`               | `pnpm install`                                        |
| `virtualenv`                | `node_modules` (auto-managed)                         |
| `Flask`                     | `React` or `Fastify` (for front/backend respectively) |
| `uvicorn main:app --reload` | `pnpm dev` (starts a hot-reloading dev server)        |

`pnpm create vite@latest apps/web -- --template react-ts`

| Part                  | Meaning                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm`                | Your **package manager** (like `pip` for Python). It runs commands and installs packages.                                                                   |
| `create vite@latest`  | “Run the latest version of the **Vite project generator**.” Vite is a **modern web build tool** — it sets up a fast React + TypeScript environment for you. |
| `apps/web`            | The **folder name** where the new project will be created. So you’ll get: `running-vision/apps/web`.                                                        |
| `--`                  | This double dash tells pnpm: “Everything after this belongs to the _Vite tool_, not pnpm itself.”                                                           |
| `--template react-ts` | The option passed to Vite. It means: “Create a project using the React + TypeScript template.”                                                              |

Node.js → lets you run JS on your Mac ouside of browser (like Python runs .py files).

pnpm → installs and manages project dependencies.

Vite → sets up a modern web dev environment quickly.

pnpm create vite@latest apps/web -- --template react-ts → creates a new React + TypeScript web project inside apps/web.
