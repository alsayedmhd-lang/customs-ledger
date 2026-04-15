import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

const allowedOrigins = [
  "https://customs-ledger-front.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const isExactAllowed = allowedOrigins.includes(origin);
    const isVercelPreview = origin.includes("vercel.app");

    if (isExactAllowed || isVercelPreview) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("🚀 Around The World Custom Clearance!");
});

app.use("/api", router);

export default app;
