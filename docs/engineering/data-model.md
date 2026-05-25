# Switchplay Data Model

## Core Concept

Switchplay is built around progress decks.

A deck represents a medium-term goal, usually lasting 4–6 weeks. Examples include football performance goals, gym goals, calisthenics skills, or body composition goals.

Each deck contains weekly cards. A card represents one week of focused work toward that goal.

## Main Entities

## User

The signed-in user should be referred to as `user`.

For now, mock user data only needs:

```ts
type User = {
  id: string;
  name: string;
  decks: Deck[];
};

Connections

Other users on the platform should be referred to as connections.

Connections may include friends, teammates, coaches, or other users who can comment on progress.

type Connection = {
  id: string;
  name: string;
};

Deck

A deck represents a 4–6 week progression block.

type Deck = {
  id: string;
  title: string;
  category: "football" | "gym" | "calisthenics";
  status: "todo" | "inProgress" | "completed";
  cards: Card[];
};

Card

A card represents a weekly milestone inside a deck.

Card titles may be simple, such as Week 1, Week 2, etc.

The subtitle should explain the specific focus of that week.

type Card = {
  id: string;
  title: string;
  subtitle: string;
  targetDate: string;
  intro: Intro;
  items: Item[];
  stats: Stat[];
  mediaItems: MediaItem[];
  chats: Chat[];
};

Intro

The intro gives context for the weekly card.
type Intro = {
  description: string;
  mediaItem: MediaItem;
};

Item

An item is an action step for the week.
type Item = {
  id: string;
  description: string;
  mediaItem: MediaItem;
  completionStatus: "todo" | "inProgress" | "done";
};

Stat

A stat tracks measurable progress.

order describes whether progress means the value should increase or decrease.
type Stat = {
  id: string;
  title: string;
  description: string;
  order: "increasing" | "decreasing";
  startValue: number;
  endValue: number;
  targetValue: number;
  unit: string;
};

MediaItem

Media items may be uploaded files or external embeds.

Local uploaded media will likely be stored in S3. External videos may use YouTube or Vimeo embeds.
type MediaItem = {
  id: string;
  mediaType: "img" | "video" | "embeddedVideo";
  url: string;
  title?: string;
  alt?: string;
  provider?: "youtube" | "vimeo";
  durationSeconds?: number;
};

Chat

A chat contains comments related to a card.

Comments may come from the signed-in user or from connections.
type Chat = {
  id: string;
  comments: Comment[];
};

type Comment = {
  id: string;
  creatorId: string;
  createdAt: string;
  text: string;
};

Mock Data Rules

Mock data should feel realistic and relevant to the target user.

The current mock user is an 18-year-old who:

is serious about football
trains in the gym
works on body composition
is interested in calisthenics
uses the app to track medium-term progress

Decks should include:

football performance goals
gym/fitness goals
calisthenics goals

Some decks should be completed, with past dates and mostly achieved stats.

Most decks should be mid-progress, such as week 3 of 5 or week 4 of 6.

Naming Rules

Use:

user for the signed-in user
connections for other users
decks for medium-term goals
cards for weekly milestones
items for weekly action steps
stats for measurable targets
mediaItems for videos/images
chats for card-level discussion