import { useState } from "react";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");

  function handleLogin() {
    if (username === "admin" && password === "admin123") {
      setLoggedIn(true);
      setError("");
    } else {
      setError("Invalid username or password");
    }
  }

  if (loggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f7fb",
          padding: "40px",
          fontFamily: "system-ui",
        }}
      >
        <h1>Dashboard</h1>
        <p>Welcome to Around The World Custom Clearance</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        fontFamily: "system-ui",
        background: "#f5f7fb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ textAlign: "center" }}>
          Around The World Custom Clearance
        </h1>

        <p style={{ textAlign: "center", color: "#666" }}>Login to continue</p>

        <div style={{ marginTop: "20px" }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              borderRadius: "10px",
              border: "1px solid #ccc",
              boxSizing: "border-box",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              borderRadius: "10px",
              border: "1px solid #ccc",
              boxSizing: "border-box",
            }}
          />

          {error && (
            <p style={{ color: "red", fontSize: "14px" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: "12px",
              border: "none",
              borderRadius: "10px",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}





// import { useEffect, useState, type ComponentType } from "react";

// import { modules as discoveredModules } from "./.generated/mockup-components";

// type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

// function _resolveComponent(
//   mod: Record<string, unknown>,
//   name: string,
// ): ComponentType | undefined {
//   const fns = Object.values(mod).filter(
//     (v) => typeof v === "function",
//   ) as ComponentType[];
//   return (
//     (mod.default as ComponentType) ||
//     (mod.Preview as ComponentType) ||
//     (mod[name] as ComponentType) ||
//     fns[fns.length - 1]
//   );
// }

// function PreviewRenderer({
//   componentPath,
//   modules,
// }: {
//   componentPath: string;
//   modules: ModuleMap;
// }) {
//   const [Component, setComponent] = useState<ComponentType | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     let cancelled = false;

//     setComponent(null);
//     setError(null);

//     async function loadComponent(): Promise<void> {
//       const key = `./components/mockups/${componentPath}.tsx`;
//       const loader = modules[key];
//       if (!loader) {
//         setError(`No component found at ${componentPath}.tsx`);
//         return;
//       }

//       try {
//         const mod = await loader();
//         if (cancelled) {
//           return;
//         }
//         const name = componentPath.split("/").pop()!;
//         const comp = _resolveComponent(mod, name);
//         if (!comp) {
//           setError(
//             `No exported React component found in ${componentPath}.tsx\n\nMake sure the file has at least one exported function component.`,
//           );
//           return;
//         }
//         setComponent(() => comp);
//       } catch (e) {
//         if (cancelled) {
//           return;
//         }

//         const message = e instanceof Error ? e.message : String(e);
//         setError(`Failed to load preview.\n${message}`);
//       }
//     }

//     void loadComponent();

//     return () => {
//       cancelled = true;
//     };
//   }, [componentPath, modules]);

//   if (error) {
//     return (
//       <pre style={{ color: "red", padding: "2rem", fontFamily: "system-ui" }}>
//         {error}
//       </pre>
//     );
//   }

//   if (!Component) return null;

//   return <Component />;
// }

// function getBasePath(): string {
//   return import.meta.env.BASE_URL.replace(/\/$/, "");
// }

// function getPreviewExamplePath(): string {
//   const basePath = getBasePath();
//   return `${basePath}/preview/ComponentName`;
// }

// function Gallery() {
//   return (
//     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
//       <div className="text-center max-w-md">
//         <h1 className="text-2xl font-semibold text-gray-900 mb-3">
//           Component Preview Server
//         </h1>
//         <p className="text-gray-500 mb-4">
//           This server renders individual components for the workspace canvas.
//         </p>
//         <p className="text-sm text-gray-400">
//           Access component previews at{" "}
//           <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
//             {getPreviewExamplePath()}
//           </code>
//         </p>
//       </div>
//     </div>
//   );
// }

// function getPreviewPath(): string | null {
//   const basePath = getBasePath();
//   const { pathname } = window.location;
//   const local =
//     basePath && pathname.startsWith(basePath)
//       ? pathname.slice(basePath.length) || "/"
//       : pathname;
//   const match = local.match(/^\/preview\/(.+)$/);
//   return match ? match[1] : null;
// }

// function App() {
//   const previewPath = getPreviewPath();

//   if (previewPath) {
//     return (
//       <PreviewRenderer
//         componentPath={previewPath}
//         modules={discoveredModules}
//       />
//     );
//   }

//   return <Gallery />;
// }

// export default App;
