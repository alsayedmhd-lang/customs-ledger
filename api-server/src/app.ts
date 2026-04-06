import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. إضافة المسار الرئيسي قبل الـ Router لضمان ظهوره في المتصفح
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("🚀 Around The Worled Custom Clearance!");
});

// 2. مسارات الـ API الأخرى
app.use("/api", router);

export default app;
