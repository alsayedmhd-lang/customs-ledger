import express, { type Express, Request, Response } from "express"; // أضفنا Request و Response للوضوح
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// *********** أضف هذا الجزء هنا ***********
app.get("/", (req: Request, res: Response) => {
  res.send("🚀 Customs Ledger API is running smoothly!");
});
// *****************************************

app.use("/api", router);

export default app;
