import express, { type Express, type Request, type Response } from "express";
import cors, { type CorsOptionsDelegate } from "cors";
import router from "./routes";

const app: Express = express();

const allowedOrigins = [
  "https://customs-ledger-front.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const corsOptions: CorsOptionsDelegate<Request> = (req, callback) => {
  const origin = req.header("Origin");

  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, {
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
    return;
  }

  callback(null, {
    origin: false,
  });
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("🚀 Around The World Custom Clearance API");
});

app.use("/api", router);

export default app;
