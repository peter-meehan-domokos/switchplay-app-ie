import { expect, test } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MediaUploadPanel from "@/components/media/MediaUploadPanel";
import UserCardMediaUploadPanel from "@/components/media/UserCardMediaUploadPanel";
import { initialUserCardMediaUploadState } from "@/components/media/useKeyedUserCardMediaUploadController";
import type { CloudflareR2ImageMediaItem, CloudflareStreamVideoMediaItem } from "@/lib/media";
import { selectVisibleUserCardMediaItems } from "@/lib/userCardMedia";

type PlaywrightJsxElement = {
  __pw_type: string;
  key?: string | number | null;
  props: Record<string, unknown>;
  type: React.ElementType;
};

function isPlaywrightJsxElement(value: unknown): value is PlaywrightJsxElement {
  return typeof value === "object" && value !== null && "__pw_type" in value;
}

function adaptPlaywrightJsx(value: unknown, fallbackKey?: number): React.ReactNode {
  if (Array.isArray(value)) {
    return value.map((item, index) => adaptPlaywrightJsx(item, index));
  }

  if (!isPlaywrightJsxElement(value)) {
    return value as React.ReactNode;
  }

  const { children, ...props } = value.props;
  const key = value.key ?? fallbackKey;
  const normalizedProps = { ...props, key, children: adaptPlaywrightJsx(children) };

  return typeof value.type === "function"
    ? React.createElement(PlaywrightJsxAdapter, { component: value.type, componentProps: normalizedProps, key })
    : React.createElement(value.type, normalizedProps);
}

function PlaywrightJsxAdapter({ component: Component, componentProps }: {
  component: React.ElementType;
  componentProps: Record<string, unknown>;
}) {
  return adaptPlaywrightJsx((Component as (props: Record<string, unknown>) => unknown)(componentProps));
}

function renderComponent(Component: React.ElementType, props: Record<string, unknown>) {
  return renderToStaticMarkup(React.createElement(PlaywrightJsxAdapter, { component: Component, componentProps: props }));
}

function CreatorTreeText() {
  return JSON.stringify(MediaUploadPanel({
    image: images[0],
    video: videos[0],
    onRemoveImage: () => undefined,
    onUploadImage: () => undefined,
    onUploadVideo: () => undefined,
  }));
}

const target = { scope: "user-card", deckTemplateId: "deck-1", cardId: "card-1" } as const;
const images: CloudflareR2ImageMediaItem[] = [1, 2, 3].map((index) => ({
  id: `image-${index}`,
  description: `Photo ${index}`,
  mediaType: "image",
  provider: "cloudflare-r2",
  assetId: `user-decks/user-1/deck-1/cards/card-1/${index}.png`,
  src: `https://user-uploads.example.com/${index}.png`,
}));
const videos: CloudflareStreamVideoMediaItem[] = [1, 2, 3].map((index) => ({
  id: `stream-${index}`,
  description: `Clip ${index}`,
  mediaType: "video",
  provider: "cloudflare-stream",
  assetId: `uid-${index}`,
  src: `https://iframe.videodelivery.net/uid-${index}`,
}));

function renderPanel(options?: {
  imageBusy?: boolean;
  videoBusy?: boolean;
  images?: CloudflareR2ImageMediaItem[];
  videos?: CloudflareStreamVideoMediaItem[];
  removingId?: string;
}) {
  const imageItems = options?.images ?? images;
  const videoItems = options?.videos ?? videos;

  return renderComponent(
    UserCardMediaUploadPanel,
    {
      images: imageItems,
      videos: videoItems,
      target,
      uploadState: {
        ...initialUserCardMediaUploadState,
        imageUploadStage: options?.imageBusy ? "saving" : "idle",
        isImageUploading: options?.imageBusy ?? false,
        isVideoUploading: options?.videoBusy ?? false,
        videoUploadStage: options?.videoBusy ? "uploading" : "idle",
      },
      removalStatesById: options?.removingId ? { [options.removingId]: { error: null, isRemoving: true } } : {},
      onAddImage: () => undefined,
      onAddVideo: () => undefined,
      onRemoveMedia: () => undefined,
    },
  );
}

test("the card modal lists three images and three videos with exact-item removal", () => {
  const html = renderPanel();

  for (const item of [...images, ...videos]) {
    expect(html).toContain(`data-media-item-id="${item.id}"`);
    expect(html).toContain(`(${item.id})`);
  }
  expect(html).toContain("+ Add image");
  expect(html).toContain("+ Add video");
  expect(html).not.toContain("Replace image");
  expect(html).not.toContain("Replace video");
  expect(html).not.toContain("<iframe");
});

test("each Add control remains visible and only its own busy type is disabled", () => {
  const imageBusyHtml = renderPanel({ imageBusy: true });
  const videoBusyHtml = renderPanel({ videoBusy: true });

  expect(imageBusyHtml).toMatch(/<button[^>]*disabled=""[^>]*>\+ Add image<\/button>/);
  expect(imageBusyHtml).not.toMatch(/<button[^>]*disabled=""[^>]*>\+ Add video<\/button>/);
  expect(imageBusyHtml).toContain("Saving image…");
  expect(videoBusyHtml).toMatch(/<button[^>]*disabled=""[^>]*>\+ Add video<\/button>/);
  expect(videoBusyHtml).not.toMatch(/<button[^>]*disabled=""[^>]*>\+ Add image<\/button>/);
  expect(videoBusyHtml).toContain("Uploading video…");
});

test("removing a middle item leaves the other tiles and disables only the selected Remove control", () => {
  const removingHtml = renderPanel({ removingId: images[1].id });

  expect(removingHtml).toMatch(/aria-label="Remove image Photo 2 \(image-2\)"[^>]*disabled=""/);
  expect(removingHtml).not.toMatch(/aria-label="Remove image Photo 1 \(image-1\)"[^>]*disabled=""/);
  const afterRemovalHtml = renderPanel({ images: [images[0], images[2]], videos });
  expect(afterRemovalHtml).not.toContain(`data-media-item-id="${images[1].id}"`);
  expect(afterRemovalHtml).toContain(`data-media-item-id="${images[2].id}"`);
});

test("removing the first image or video promotes the next valid item on the card back", () => {
  const rawItems = [images[0], videos[0], images[1], videos[1]];

  expect(selectVisibleUserCardMediaItems(rawItems)).toEqual([images[0], videos[0]]);
  expect(selectVisibleUserCardMediaItems(rawItems.filter((item) => item.id !== images[0].id))).toEqual([images[1], videos[0]]);
  expect(selectVisibleUserCardMediaItems(rawItems.filter((item) => item.id !== videos[0].id))).toEqual([images[0], videos[1]]);
});

test("Creator deck introduction still renders replacement slots", () => {
  const html = renderToStaticMarkup(React.createElement(CreatorTreeText));

  expect(html).toContain("Replace image");
  expect(html).toContain("Replace video");
  expect(html).toContain("Remove image");
  expect(html).not.toContain("Remove video");
});
