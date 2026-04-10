import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

const allowedOrigins = [
  "https://customs-ledger-front.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const isExactAllowed = allowedOrigins.includes(origin);
      const isVercelPreview =
        /^https:\/\/customs-ledger-front-.*\.vercel\.app$/.test(origin);

      if (isExactAllowed || isVercelPreview) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);

app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("🚀 Around The World Custom Clearance!");
});

app.use("/api", router);

export default app;
