import { expect, test } from "@playwright/test";
import { build } from "esbuild";

test("acknowledged videos keep checking while a new attachment waits for its own save", async ({ page }) => {
  page.on("pageerror", error => { throw error; });
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import Modal from './src/components/creator/CreatorStepMediaModal';
    const video = id => ({id,label:id,kind:'video',media:{id,mediaType:'video',provider:'cloudflare-stream',assetId:id,src:'https://iframe.videodelivery.net/'+id,description:id}});
    const old=video('Old'), fresh=video('New');
    function App(){const [source,setSource]=useState(null),[saved,setSaved]=useState([old.media]); window.acknowledgeVideoSave=()=>setSaved([old.media,fresh.media]);
      return <><button onClick={e=>setSource(e.currentTarget)}>Open</button>{source&&<Modal title="Step media" items={[old,fresh]} acknowledgedMedia={saved}
        multimediaEnabled uploading disabled={false} readinessTarget={{scope:'card-template',deckTemplateId:'deck',cardTemplateId:'card'}} returnFocus={source}
        onChange={()=>{}} onUpload={async()=>{}} onCancelUpload={()=>{}} onClose={()=>setSource(null)}/>}</>;}
    createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, outfile: "creator-status.js", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_PHASE2_MOCK_MEDIA": '"0"' } });
  const html = `<!doctype html><style>${result.outputFiles.find(f => f.path.endsWith(".css"))!.text}</style><div id="root"></div><script>${result.outputFiles.find(f => f.path.endsWith(".js"))!.text}</script>`;
  const requests: string[] = [];
  await page.route("https://creator-status.invalid/**", route => {
    if (route.request().url().includes("/api/media/stream/status?")) {
      requests.push(new URL(route.request().url()).searchParams.get("assetId")!);
      return route.fulfill({ json: { status: "ready" } });
    }
    return route.fulfill({ contentType: "text/html", body: html });
  });
  await page.goto("https://creator-status.invalid/"); await page.getByRole("button", { name: "Open", exact: true }).click();
  const items = page.locator("dialog li");
  await expect(items.first().getByText("Video ready", { exact: true })).toBeVisible(); expect(requests).toEqual(["Old"]);
  await page.evaluate(() => (window as unknown as { acknowledgeVideoSave: () => void }).acknowledgeVideoSave());
  await expect(items.last().getByText("Video ready", { exact: true })).toBeVisible(); expect(requests).toEqual(["Old", "New"]);
});
