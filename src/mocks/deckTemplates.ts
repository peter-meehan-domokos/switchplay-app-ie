import type { DeckTemplate } from "@/components/decks/types";

export const deckTemplates: DeckTemplate[] = [
  {
    deckTemplateId: "deck-2026-06-open-loops-001",
    title: "Clear The Open Loops",
    category: "life-admin",
    cards: [
      {
        cardId: "open-loops-card-001",
        title: "Week 1",
        subtitle: "Create Clarity",
        suggestedTargetDate: "2026-06-07",
        intro: {
          description: "Clarify the app, finances and places where outreach is being avoided.",
          mediaItem: {
            id: "open-loops-media-001",
            mediaType: "image",
            description: "Create Clarity",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "open-loops-item-001",
            description: "Build video app prototype and review with John"
          },
          {
            itemId: "open-loops-item-002",
            description: "Build a first financial projection through December"
          },
          {
            itemId: "open-loops-item-003",
            description: "Identify where you are currently avoiding outreach"
          }
        ],
        signals: [
          {
            signalId: "open-loops-signal-001",
            title: "John's App Clarity",
            description: "How clear the next version of the app feels after reviewing it with John",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "commitments"
          },
          {
            signalId: "open-loops-signal-002",
            title: "Financial Visibility",
            description: "How clearly you can see your financial position through December",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "foundations"
          },
          {
            signalId: "open-loops-signal-003",
            title: "Outreach Resistance",
            description: "How much avoidance currently exists around reaching out to people",
            order: "decreasing",
            targetValue: 2,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "initiative"
          }
        ]
      },
      {
        cardId: "open-loops-card-002",
        title: "Week 2",
        subtitle: "Take Action",
        suggestedTargetDate: "2026-06-14",
        intro: {
          description: "Address family plans, do priority admin and begin outreach.",
          mediaItem: {
            id: "open-loops-media-002",
            mediaType: "image",
            description: "Take Action",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "open-loops-item-004",
            description: "Talk to your dad and make progress on summer plans"
          },
          {
            itemId: "open-loops-item-005",
            description: "Do priority admin and outstanding obligations"
          },
          {
            itemId: "open-loops-item-006",
            description: "Reach out to people connected to your existing goals and projects"
          }
        ],
        signals: [
          {
            signalId: "open-loops-signal-004",
            title: "Family Stability",
            description: "How settled and constructive important family relationships feel",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "commitments"
          },
          {
            signalId: "open-loops-signal-005",
            title: "Admin Control",
            description: "How in control of practical responsibilities and obligations you feel",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "foundations"
          },
          {
            signalId: "open-loops-signal-006",
            title: "People Contacted",
            description: "Meaningful outreach actions taken",
            order: "increasing",
            targetValue: 4,
            minValue: 0,
            maxValue: 5,
            unit: "people",
            dimension: "initiative"
          }
        ]
      },
      {
        cardId: "open-loops-card-003",
        title: "Week 3",
        subtitle: "Build Momentum",
        suggestedTargetDate: "2026-06-21",
        intro: {
          description: "Build momentum with John, prepare for moving out and continue outreach.",
          mediaItem: {
            id: "open-loops-media-003",
            mediaType: "image",
            description: "Build Momentum",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "open-loops-item-007",
            description: "Improve the video editing app with John and review progress together"
          },
          {
            itemId: "open-loops-item-008",
            description: "Clean flat, pack and get ready to move out"
          },
          {
            itemId: "open-loops-item-009",
            description: "Continue outreach and experiment with posting or sharing work publicly"
          }
        ],
        signals: [
          {
            signalId: "open-loops-signal-007",
            title: "Shared Momentum",
            description: "How much progress and forward movement John and you feel together",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "commitments"
          },
          {
            signalId: "open-loops-signal-008",
            title: "Move Readiness",
            description: "How prepared you feel for the upcoming move",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "foundations"
          },
          {
            signalId: "open-loops-signal-009",
            title: "Outreach Rhythm",
            description: "How natural and consistent outreach is beginning to feel",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "initiative"
          }
        ]
      },
      {
        cardId: "open-loops-card-004",
        title: "Week 4",
        subtitle: "Create Peace Of Mind",
        suggestedTargetDate: "2026-06-28",
        intro: {
          description: "Settle key relationships, strengthen foundations and make initiative feel normal.",
          mediaItem: {
            id: "open-loops-media-004",
            mediaType: "image",
            description: "Create Peace Of Mind",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "open-loops-item-010",
            description: "Leave key family relationships stable and understood going into summer"
          },
          {
            itemId: "open-loops-item-011",
            description: "Finish June with clear financial visibility through December"
          },
          {
            itemId: "open-loops-item-012",
            description: "Make reaching out feel like a normal part of your work rather than something to avoid"
          }
        ],
        signals: [
          {
            signalId: "open-loops-signal-010",
            title: "Commitments Settled",
            description: "How settled important relationships and commitments feel overall",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "commitments"
          },
          {
            signalId: "open-loops-signal-011",
            title: "Life Foundations",
            description: "Overall confidence that practical life is organised and under control",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "foundations"
          },
          {
            signalId: "open-loops-signal-012",
            title: "Initiative Confidence",
            description: "Confidence in putting yourself forward and taking initiative",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "initiative"
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-teaching-income-001",
    title: "Create Teaching Income Option For September",
    category: "education",
    cards: [
      {
        cardId: "teaching-card-001",
        title: "Week 1",
        subtitle: "Start The Process",
        suggestedTargetDate: "2026-06-07",
        intro: {
          description: "Begin the registration process, prepare tutoring foundations and design the first maths lesson.",
          mediaItem: {
            id: "teaching-media-001",
            mediaType: "image",
            description: "Start The Process",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "teaching-item-001",
            description: "Begin registration, Garda and reference requirements"
          },
          {
            itemId: "teaching-item-002",
            description: "Research and select tutoring platforms"
          },
          {
            itemId: "teaching-item-003",
            description: "Plan the first maths lesson and activity"
          }
        ],
        signals: [
          {
            signalId: "teaching-signal-001",
            title: "Registration readiness",
            description: "Progress towards registration, Garda and supporting requirements",
            order: "increasing",
            targetValue: 4,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "registration"
          },
          {
            signalId: "teaching-signal-002",
            title: "Tutoring foundations",
            description: "Progress towards tutoring profiles, reviews and platform setup",
            order: "increasing",
            targetValue: 4,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "presence"
          },
          {
            signalId: "teaching-signal-003",
            title: "Lesson progress",
            description: "Progress towards a completed maths lesson and activity",
            order: "increasing",
            targetValue: 7,
            minValue: 0,
            maxValue: 10,
            unit: "",
            dimension: "credibility"
          }
        ]
      },
      {
        cardId: "teaching-card-002",
        title: "Week 2",
        subtitle: "Complete The Foundations",
        suggestedTargetDate: "2026-06-14",
        intro: {
          description: "Advance registration, establish tutoring profiles and begin creating the first maths lesson.",
          mediaItem: {
            id: "teaching-media-002",
            mediaType: "image",
            description: "Complete The Foundations",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "teaching-item-004",
            description: "Complete registration and Garda requirements where possible"
          },
          {
            itemId: "teaching-item-005",
            description: "Create tutoring profiles and core information"
          },
          {
            itemId: "teaching-item-006",
            description: "Create the first maths video and accompanying activity"
          }
        ],
        signals: [
          {
            signalId: "teaching-signal-004",
            title: "Registration readiness",
            description: "Progress towards registration, Garda and supporting requirements",
            order: "increasing",
            targetValue: 4,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "registration"
          },
          {
            signalId: "teaching-signal-005",
            title: "Tutoring foundations",
            description: "Progress towards tutoring profiles, reviews and platform setup",
            order: "increasing",
            targetValue: 4,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "presence"
          },
          {
            signalId: "teaching-signal-006",
            title: "Lesson progress",
            description: "Progress towards a completed maths lesson and activity",
            order: "increasing",
            targetValue: 8,
            minValue: 0,
            maxValue: 10,
            unit: "",
            dimension: "credibility"
          }
        ]
      },
      {
        cardId: "teaching-card-003",
        title: "Week 3",
        subtitle: "Become Visible",
        suggestedTargetDate: "2026-06-21",
        intro: {
          description: "Make yourself visible to schools, tutoring platforms and potential students.",
          mediaItem: {
            id: "teaching-media-003",
            mediaType: "image",
            description: "Become Visible",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "teaching-item-007",
            description: "Reach out to schools and relevant contacts"
          },
          {
            itemId: "teaching-item-008",
            description: "Publish tutoring profiles and improve presentation"
          },
          {
            itemId: "teaching-item-009",
            description: "Publish the first maths lesson on the website"
          }
        ],
        signals: [
          {
            signalId: "teaching-signal-007",
            title: "School outreach",
            description: "Schools contacted and made aware of your availability",
            order: "increasing",
            targetValue: 5,
            minValue: 0,
            maxValue: 5,
            unit: "schools",
            dimension: "registration"
          },
          {
            signalId: "teaching-signal-008",
            title: "Active profiles",
            description: "Tutoring platforms with active public profiles",
            order: "increasing",
            targetValue: 2,
            minValue: 0,
            maxValue: 2,
            unit: "profiles",
            dimension: "presence"
          },
          {
            signalId: "teaching-signal-009",
            title: "Lesson completeness",
            description: "How complete the first maths lesson feels overall",
            order: "increasing",
            targetValue: 8,
            minValue: 0,
            maxValue: 10,
            unit: "",
            dimension: "credibility"
          }
        ]
      },
      {
        cardId: "teaching-card-004",
        title: "Week 4",
        subtitle: "Be Ready For September",
        suggestedTargetDate: "2026-06-28",
        intro: {
          description: "Consolidate progress and ensure the foundations are in place for September opportunities.",
          mediaItem: {
            id: "teaching-media-004",
            mediaType: "image",
            description: "Be Ready For September",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "teaching-item-010",
            description: "Resolve remaining registration tasks and follow-ups"
          },
          {
            itemId: "teaching-item-011",
            description: "Refine profiles and research other avenues"
          },
          {
            itemId: "teaching-item-012",
            description: "Review what has been created and identify the next content priorities"
          }
        ],
        signals: [
          {
            signalId: "teaching-signal-010",
            title: "September readiness",
            description: "Confidence that the teaching pathway is ready for September",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "registration"
          },
          {
            signalId: "teaching-signal-011",
            title: "Tutoring visibility",
            description: "Confidence that potential students can find and assess you",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "presence"
          },
          {
            signalId: "teaching-signal-012",
            title: "Teaching confidence",
            description: "Confidence in the quality and credibility of your maths teaching materials",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "credibility"
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-health-fitness-001",
    title: "Make Healthy Habits Feel Natural",
    category: "health-fitness",
    cards: [
      {
        cardId: "health-card-001",
        title: "Week 1",
        subtitle: "Strengthen The Foundations",
        suggestedTargetDate: "2026-06-07",
        intro: {
          description: "Rebuild the base through meditation, better gym structure and food planning.",
          mediaItem: {
            id: "health-media-001",
            mediaType: "image",
            description: "Strengthen The Foundations",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "health-item-001",
            description: "Meditate on four days and establish a regular cue"
          },
          {
            itemId: "health-item-002",
            description: "Give core work and warm-ups greater attention in gym sessions"
          },
          {
            itemId: "health-item-003",
            description: "Organise shopping and meal preparation for the week ahead"
          }
        ],
        signals: [
          {
            signalId: "health-signal-001",
            title: "Meditation consistency",
            description: "Days this week when meditation actually happened",
            order: "increasing",
            targetValue: 5,
            minValue: 0,
            maxValue: 7,
            unit: "days",
            dimension: "awareness"
          },
          {
            signalId: "health-signal-002",
            title: "Professional sessions",
            description: "Training days with proper warm-up, core work and balanced execution",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "sessions",
            dimension: "capacity"
          },
          {
            signalId: "health-signal-003",
            title: "Healthy days",
            description: "Days with good eating and sleep supporting recovery",
            order: "increasing",
            targetValue: 5,
            minValue: 0,
            maxValue: 7,
            unit: "days",
            dimension: "recovery"
          }
        ]
      },
      {
        cardId: "health-card-002",
        title: "Week 2",
        subtitle: "Build Consistency",
        suggestedTargetDate: "2026-06-14",
        intro: {
          description: "Make meditation more regular while protecting training and nutrition during busy periods.",
          mediaItem: {
            id: "health-media-002",
            mediaType: "image",
            description: "Build Consistency",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "health-item-004",
            description: "Meditate on most days of the week"
          },
          {
            itemId: "health-item-005",
            description: "Maintain a consistent gym routine while continuing the cut"
          },
          {
            itemId: "health-item-006",
            description: "Maintain healthy eating even during busy work periods"
          }
        ],
        signals: [
          {
            signalId: "health-signal-004",
            title: "Days without resistance",
            description: "Days when sitting down to meditate did not feel like a struggle",
            order: "increasing",
            targetValue: 4,
            minValue: 0,
            maxValue: 7,
            unit: "days",
            dimension: "awareness"
          },
          {
            signalId: "health-signal-005",
            title: "Professional sessions",
            description: "Training days with proper warm-up, core work and balanced execution",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "sessions",
            dimension: "capacity"
          },
          {
            signalId: "health-signal-006",
            title: "Healthy days",
            description: "Days with good eating and sleep supporting recovery",
            order: "increasing",
            targetValue: 5,
            minValue: 0,
            maxValue: 7,
            unit: "days",
            dimension: "recovery"
          }
        ]
      },
      {
        cardId: "health-card-003",
        title: "Week 3",
        subtitle: "Increase Quality",
        suggestedTargetDate: "2026-06-21",
        intro: {
          description: "Improve the quality of attention, training execution and recovery support.",
          mediaItem: {
            id: "health-media-003",
            mediaType: "image",
            description: "Increase Quality",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "health-item-007",
            description: "Lengthen meditation and improve quality of attention"
          },
          {
            itemId: "health-item-008",
            description: "Improve training quality through better pacing and execution"
          },
          {
            itemId: "health-item-009",
            description: "Maintain nutrition consistency through planning and preparation"
          }
        ],
        signals: [
          {
            signalId: "health-signal-007",
            title: "Quality of attention",
            description: "How present and settled meditation felt this week",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "awareness"
          },
          {
            signalId: "health-signal-008",
            title: "Professional sessions",
            description: "Training days with proper warm-up, core work and balanced execution",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "sessions",
            dimension: "capacity"
          },
          {
            signalId: "health-signal-009",
            title: "Healthy days",
            description: "Days with good eating and sleep supporting recovery",
            order: "increasing",
            targetValue: 5,
            minValue: 0,
            maxValue: 7,
            unit: "days",
            dimension: "recovery"
          }
        ]
      },
      {
        cardId: "health-card-004",
        title: "Week 4",
        subtitle: "Trust The System",
        suggestedTargetDate: "2026-06-28",
        intro: {
          description: "Let the routine feel natural, sustainable and easier to trust.",
          mediaItem: {
            id: "health-media-004",
            mediaType: "image",
            description: "Trust The System",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "health-item-010",
            description: "Let meditation become a normal part of daily life"
          },
          {
            itemId: "health-item-011",
            description: "Run a professional and sustainable training routine"
          },
          {
            itemId: "health-item-012",
            description: "Maintain nutrition and sleep without constant effort"
          }
        ],
        signals: [
          {
            signalId: "health-signal-010",
            title: "Meditation pull",
            description: "Days when I naturally wanted to meditate",
            order: "increasing",
            targetValue: 4,
            minValue: 0,
            maxValue: 7,
            unit: "days",
            dimension: "awareness"
          },
          {
            signalId: "health-signal-011",
            title: "Professional sessions",
            description: "Training days with proper warm-up, core work and balanced execution",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "sessions",
            dimension: "capacity"
          },
          {
            signalId: "health-signal-012",
            title: "Healthy days",
            description: "Days with good eating and sleep supporting recovery",
            order: "increasing",
            targetValue: 5,
            minValue: 0,
            maxValue: 7,
            unit: "days",
            dimension: "recovery"
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-tebo-studio-001",
    title: "Establish Tebo Studio As Credible",
    category: "tebo-studio",
    cards: [
      {
        cardId: "tebo-card-001",
        title: "Week 1",
        subtitle: "Finish The Portfolio",
        suggestedTargetDate: "2026-06-07",
        intro: {
          description: "Complete the key project presentations and sharpen the studio principles.",
          mediaItem: {
            id: "tebo-media-001",
            mediaType: "image",
            description: "Finish The Portfolio",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "tebo-item-001",
            description: "Identify and organise promising organisations and contacts"
          },
          {
            itemId: "tebo-item-002",
            description: "Complete Switchplay and Perfect Square project presentations"
          },
          {
            itemId: "tebo-item-003",
            description: "Extract and refine key data visualisation principles through the audit example"
          }
        ],
        signals: [
          {
            signalId: "tebo-signal-001",
            title: "Promising opportunities",
            description: "Potential organisations, people or openings worth pursuing",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "network"
          },
          {
            signalId: "tebo-signal-002",
            title: "Portfolio integration",
            description: "Portfolio projects fully integrated and ready to support the studio",
            order: "increasing",
            targetValue: 2,
            minValue: 0,
            maxValue: 2,
            unit: "",
            dimension: "credibility"
          },
          {
            signalId: "tebo-signal-003",
            title: "Useful principles",
            description: "Data visualisation principles worth carrying into future work",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "perspective"
          }
        ]
      },
      {
        cardId: "tebo-card-002",
        title: "Week 2",
        subtitle: "Finish The Studio",
        suggestedTargetDate: "2026-06-14",
        intro: {
          description: "Finish the site, begin outreach and integrate the studio perspective.",
          mediaItem: {
            id: "tebo-media-002",
            mediaType: "image",
            description: "Finish The Studio",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "tebo-item-004",
            description: "Begin reaching out to selected contacts and organisations"
          },
          {
            itemId: "tebo-item-005",
            description: "Complete the Tebo Studio website and supporting pages"
          },
          {
            itemId: "tebo-item-006",
            description: "Integrate design principles into the website and audit example"
          }
        ],
        signals: [
          {
            signalId: "tebo-signal-004",
            title: "Positive responses",
            description: "Encouraging replies, interest or openings from outreach",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "network"
          },
          {
            signalId: "tebo-signal-005",
            title: "Website confidence",
            description: "Confidence that the website represents the studio well",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "credibility"
          },
          {
            signalId: "tebo-signal-006",
            title: "Principle confidence",
            description: "Confidence that the principles feel clear and useful",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "perspective"
          }
        ]
      },
      {
        cardId: "tebo-card-003",
        title: "Week 3",
        subtitle: "Start Meaningful Outreach",
        suggestedTargetDate: "2026-06-21",
        intro: {
          description: "Expand outreach and test how the portfolio and ideas land.",
          mediaItem: {
            id: "tebo-media-003",
            mediaType: "image",
            description: "Start Meaningful Outreach",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "tebo-item-007",
            description: "Continue outreach and expand relevant contacts"
          },
          {
            itemId: "tebo-item-008",
            description: "Develop outreach messages using the website and portfolio"
          },
          {
            itemId: "tebo-item-009",
            description: "Observe which ideas and examples resonate most strongly"
          }
        ],
        signals: [
          {
            signalId: "tebo-signal-007",
            title: "Promising relationships",
            description: "Relationships that feel worth developing further",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "network"
          },
          {
            signalId: "tebo-signal-008",
            title: "Message confidence",
            description: "Confidence that the outreach message is landing well",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "credibility"
          },
          {
            signalId: "tebo-signal-009",
            title: "Perspective insights",
            description: "Useful insights about which ideas resonate with others",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "perspective"
          }
        ]
      },
      {
        cardId: "tebo-card-004",
        title: "Week 4",
        subtitle: "Create Real Opportunities",
        suggestedTargetDate: "2026-06-28",
        intro: {
          description: "Turn promising outreach into conversations, opportunities and clearer positioning.",
          mediaItem: {
            id: "tebo-media-004",
            mediaType: "image",
            description: "Create Real Opportunities",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "tebo-item-010",
            description: "Hold conversations with promising contacts and organisations"
          },
          {
            itemId: "tebo-item-011",
            description: "Refine outreach messaging based on responses and feedback"
          },
          {
            itemId: "tebo-item-012",
            description: "Clarify the strongest positioning emerging from conversations"
          }
        ],
        signals: [
          {
            signalId: "tebo-signal-010",
            title: "Emerging opportunities",
            description: "Genuine opportunities, leads or possible paid work emerging",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "network"
          },
          {
            signalId: "tebo-signal-011",
            title: "Studio credibility",
            description: "Confidence that Tebo Studio feels credible to others",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "credibility"
          },
          {
            signalId: "tebo-signal-012",
            title: "Positioning clarity",
            description: "Clarity about the strongest positioning for Tebo Studio",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "perspective"
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-music-001",
    title: "Jam Freely With Fiddle And H90",
    category: "music",
    cards: [
      {
        cardId: "music-card-001",
        title: "Week 1",
        subtitle: "Build The Tools",
        suggestedTargetDate: "2026-06-07",
        intro: {
          description: "Build the foundations for scale fluency, H90 understanding and trad connections.",
          mediaItem: {
            id: "music-media-001",
            mediaType: "image",
            description: "Music deck intro",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          { itemId: "music-item-001", description: "Expand scale fluency in third position" },
          { itemId: "music-item-002", description: "Learn how H90 presets are structured" },
          { itemId: "music-item-003", description: "Attend one trad session" }
        ],
        signals: [
          {
            signalId: "music-signal-001",
            title: "New scale patterns becoming usable",
            description: "New scale patterns becoming usable",
            order: "increasing",
            targetValue: 2,
            minValue: 0,
            maxValue: 2,
            unit: "",
            dimension: "fluency"
          },
          {
            signalId: "music-signal-002",
            title: "H90 controls understood",
            description: "H90 controls understood",
            order: "increasing",
            targetValue: 5,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "sound"
          },
          {
            signalId: "music-signal-003",
            title: "Meaningful trad encounters",
            description: "Meaningful trad encounters",
            order: "increasing",
            targetValue: 2,
            minValue: 0,
            maxValue: 2,
            unit: "",
            dimension: "connection"
          }
        ]
      },
      {
        cardId: "music-card-002",
        title: "Week 2",
        subtitle: "Explore The Possibilities",
        suggestedTargetDate: "2026-06-14",
        intro: {
          description: "Expand positions, begin shaping sounds and meet more promising musicians.",
          mediaItem: {
            id: "music-media-002",
            mediaType: "image",
            description: "Music deck week 2",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          { itemId: "music-item-004", description: "Extend fluency into second and fourth positions" },
          { itemId: "music-item-005", description: "Begin shaping presets into my own sounds" },
          { itemId: "music-item-006", description: "Attend two trad sessions" }
        ],
        signals: [
          {
            signalId: "music-signal-004",
            title: "Scales becoming familiar",
            description: "Scales becoming familiar",
            order: "increasing",
            targetValue: 4,
            minValue: 0,
            maxValue: 4,
            unit: "",
            dimension: "fluency"
          },
          {
            signalId: "music-signal-005",
            title: "Presets successfully personalised",
            description: "Presets successfully personalised",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 3,
            unit: "",
            dimension: "sound"
          },
          {
            signalId: "music-signal-006",
            title: "New musicians worth knowing",
            description: "New musicians worth knowing",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 3,
            unit: "",
            dimension: "connection"
          }
        ]
      },
      {
        cardId: "music-card-003",
        title: "Week 3",
        subtitle: "Play Without Thinking",
        suggestedTargetDate: "2026-06-21",
        intro: {
          description: "Connect positions, adjust sounds by ear and deepen the strongest connections.",
          mediaItem: {
            id: "music-media-003",
            mediaType: "image",
            description: "Music deck week 3",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          { itemId: "music-item-007", description: "Connect scales and positions naturally" },
          { itemId: "music-item-008", description: "Make sound adjustments by ear" },
          { itemId: "music-item-009", description: "Attend three trad sessions" }
        ],
        signals: [
          {
            signalId: "music-signal-007",
            title: "Scales available instinctively",
            description: "Scales available instinctively",
            order: "increasing",
            targetValue: 5,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "fluency"
          },
          {
            signalId: "music-signal-008",
            title: "Personal sounds worth keeping",
            description: "Personal sounds worth keeping",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 3,
            unit: "",
            dimension: "sound"
          },
          {
            signalId: "music-signal-009",
            title: "New strong musical connections",
            description: "New strong musical connections",
            order: "increasing",
            targetValue: 2,
            minValue: 0,
            maxValue: 2,
            unit: "",
            dimension: "connection"
          }
        ]
      },
      {
        cardId: "music-card-004",
        title: "Week 4",
        subtitle: "Know My Sound, Know My People",
        suggestedTargetDate: "2026-06-28",
        intro: {
          description: "Bring the month together through free playing, personal sounds and future plans.",
          mediaItem: {
            id: "music-media-004",
            mediaType: "image",
            description: "Music deck week 4",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          { itemId: "music-item-010", description: "Jam freely across the neck" },
          { itemId: "music-item-011", description: "Develop sounds I genuinely rely on" },
          { itemId: "music-item-012", description: "Arrange future playing plans with new connections" }
        ],
        signals: [
          {
            signalId: "music-signal-010",
            title: "Scales I can jam with confidently",
            description: "Scales I can jam with confidently",
            order: "increasing",
            targetValue: 7,
            minValue: 0,
            maxValue: 7,
            unit: "",
            dimension: "fluency"
          },
          {
            signalId: "music-signal-011",
            title: "Sounds that feel uniquely mine",
            description: "Sounds that feel uniquely mine",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 3,
            unit: "",
            dimension: "sound"
          },
          {
            signalId: "music-signal-012",
            title: "New musicians worth staying in touch with",
            description: "New musicians worth staying in touch with",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 3,
            unit: "",
            dimension: "connection"
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-switchplay-001",
    title: "Find Early Evidence For Switchplay",
    category: "switchplay",
    cards: [
      {
        cardId: "switchplay-card-001",
        title: "Week 1",
        subtitle: "Use It For Real",
        suggestedTargetDate: "2026-06-07",
        intro: {
          description: "Use Switchplay personally, gather initial reactions and design the maths exemplar.",
          mediaItem: {
            id: "switchplay-media-001",
            mediaType: "image",
            description: "Use It For Real",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "switchplay-item-001",
            description: "Use Switchplay myself every day and note friction points"
          },
          {
            itemId: "switchplay-item-002",
            description: "Show Switchplay to early target users and gather first reactions"
          },
          {
            itemId: "switchplay-item-003",
            description: "Design the maths exemplar deck and supporting materials"
          }
        ],
        signals: [
          {
            signalId: "switchplay-signal-001",
            title: "Useful product insights",
            description: "Helpful discoveries from real-world use, positive or negative",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "robustness"
          },
          {
            signalId: "switchplay-signal-002",
            title: "Interest from target users",
            description: "Overall level of interest shown by target users",
            order: "increasing",
            targetValue: 7,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "validation"
          },
          {
            signalId: "switchplay-signal-003",
            title: "Example concepts worth pursuing",
            description: "Promising ideas for exemplar content",
            order: "increasing",
            targetValue: 2,
            minValue: 0,
            maxValue: 3,
            unit: "",
            dimension: "examples"
          }
        ]
      },
      {
        cardId: "switchplay-card-002",
        title: "Week 2",
        subtitle: "Strengthen The Experience",
        suggestedTargetDate: "2026-06-14",
        intro: {
          description: "Improve the MVP, refine testing and complete the maths exemplar.",
          mediaItem: {
            id: "switchplay-media-002",
            mediaType: "image",
            description: "Strengthen The Experience",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "switchplay-item-004",
            description: "Fix the most important issues discovered through personal use"
          },
          {
            itemId: "switchplay-item-005",
            description: "Refine testing questions based on recurring reactions"
          },
          {
            itemId: "switchplay-item-006",
            description: "Film and build the maths exemplar deck"
          }
        ],
        signals: [
          {
            signalId: "switchplay-signal-004",
            title: "Important issues remaining",
            description: "Outstanding issues still affecting the experience",
            order: "decreasing",
            targetValue: 0,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "robustness"
          },
          {
            signalId: "switchplay-signal-005",
            title: "Questions worth investigating",
            description: "Useful questions emerging from user conversations",
            order: "increasing",
            targetValue: 3,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "validation"
          },
          {
            signalId: "switchplay-signal-006",
            title: "Confidence in the maths exemplar",
            description: "How strongly the maths deck represents the opportunity",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "examples"
          }
        ]
      },
      {
        cardId: "switchplay-card-003",
        title: "Week 3",
        subtitle: "Put It In Front Of People",
        suggestedTargetDate: "2026-06-21",
        intro: {
          description: "Trial the product with real users and create another exemplar.",
          mediaItem: {
            id: "switchplay-media-003",
            mediaType: "image",
            description: "Put It In Front Of People",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "switchplay-item-007",
            description: "Support three trial users through their first deck"
          },
          {
            itemId: "switchplay-item-008",
            description: "Test Switchplay with more target users and probe deeper issues"
          },
          {
            itemId: "switchplay-item-009",
            description: "Create one additional exemplar deck with a real participant"
          }
        ],
        signals: [
          {
            signalId: "switchplay-signal-007",
            title: "Successful user journeys",
            description: "Users successfully completing meaningful journeys",
            order: "increasing",
            targetValue: 2,
            minValue: 0,
            maxValue: 3,
            unit: "",
            dimension: "robustness"
          },
          {
            signalId: "switchplay-signal-008",
            title: "Most valuable discoveries",
            description: "Overall value of discoveries emerging from user testing",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "validation"
          },
          {
            signalId: "switchplay-signal-009",
            title: "Quality of content insights",
            description: "How valuable the content-related discoveries feel",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "examples"
          }
        ]
      },
      {
        cardId: "switchplay-card-004",
        title: "Week 4",
        subtitle: "Decide What The Evidence Says",
        suggestedTargetDate: "2026-06-28",
        intro: {
          description: "Review everything learned from usage, testing and exemplar creation.",
          mediaItem: {
            id: "switchplay-media-004",
            mediaType: "image",
            description: "Decide What The Evidence Says",
            src: "/images/media-traces/gym-trace-01.png"
          }
        },
        items: [
          {
            itemId: "switchplay-item-010",
            description: "Fix issues and improve usability based on trial-user feedback"
          },
          {
            itemId: "switchplay-item-011",
            description: "Analyse patterns from all user conversations and trials"
          },
          {
            itemId: "switchplay-item-012",
            description: "Create one additional exemplar deck with a real participant"
          }
        ],
        signals: [
          {
            signalId: "switchplay-signal-010",
            title: "Issues blocking adoption",
            description: "Remaining issues likely to stop people using Switchplay",
            order: "decreasing",
            targetValue: 0,
            minValue: 0,
            maxValue: 5,
            unit: "",
            dimension: "robustness"
          },
          {
            signalId: "switchplay-signal-011",
            title: "Confidence in the opportunity",
            description: "Overall confidence that Switchplay is worth pursuing further",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "validation"
          },
          {
            signalId: "switchplay-signal-012",
            title: "Clarity about great Switchplay content",
            description: "Overall understanding of what makes an exemplar effective",
            order: "increasing",
            targetValue: 8,
            minValue: 1,
            maxValue: 10,
            unit: "",
            dimension: "examples"
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-001",
    "title": "First Pull-Up to Clean Muscle-Up",
    "category": "calisthenics",
    "cards": [
      {
        "cardId": "card-001",
        "title": "Week 1",
        "subtitle": "Build strict pulling strength",
        "suggestedTargetDate": "2026-05-03",
        "intro": {
          "description": "Start by improving strict pull-up quality, scapular control and hollow-body tension.",
          "mediaItem": {
            "id": "media-001",
            "mediaType": "image",
            "description": "Strict Pull-Up Basics",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-001",
            "description": "Complete strict pull-up strength sets",
            "mediaItem": {
              "id": "media-002",
              "mediaType": "image",
              "description": "Strict pull-up form",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-002",
            "description": "Practise hollow-body holds for 3 sets of 30 seconds.",
            "mediaItem": {
              "id": "media-003",
              "mediaType": "image",
              "description": "Hollow Body Position",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-107",
            "description": "Film one clean top-position hold",
            "mediaItem": {
              "id": "media-060",
              "mediaType": "image",
              "description": "Pull-up top hold",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          }
        ],
        "signals": [
          {
            "signalId": "signal-001",
            "title": "Strict pull-ups",
            "description": "Maximum clean reps in one set",
            "order": "increasing",
            "targetValue": 7,
            "minValue": 0,
            "maxValue": 9,
            "unit": "reps",
            "dimension": "execution"
          },
          {
            "signalId": "signal-001-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-001-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-002",
        "title": "Week 2",
        "subtitle": "Add explosive pulling",
        "suggestedTargetDate": "2026-05-10",
        "intro": {
          "description": "Shift from strength to power by pulling higher and faster while keeping control.",
          "mediaItem": {
            "id": "media-005",
            "mediaType": "image",
            "description": "High Pull-Up Progressions",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-003",
            "description": "Complete 5 sets of chest-height pull-ups.",
            "mediaItem": {
              "id": "media-006",
              "mediaType": "image",
              "description": "Chest-to-Bar Pull-Up",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-004",
            "description": "Practise band-assisted transitions",
            "mediaItem": {
              "id": "media-007",
              "mediaType": "image",
              "description": "Band-assisted muscle-up transition",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-108",
            "description": "Film 3 high pulls from side angle",
            "mediaItem": {
              "id": "media-061",
              "mediaType": "image",
              "description": "High Pull Side View",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          }
        ],
        "signals": [
          {
            "signalId": "signal-002",
            "title": "Chest-height pull-ups",
            "description": "Best set of explosive reps",
            "order": "increasing",
            "targetValue": 5,
            "minValue": 0,
            "maxValue": 6,
            "unit": "reps",
            "dimension": "execution"
          },
          {
            "signalId": "signal-002-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-002-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-003",
        "title": "Week 3",
        "subtitle": "Control the transition",
        "suggestedTargetDate": "2026-05-17",
        "intro": {
          "description": "This week focuses on turning over the bar smoothly without losing tension.",
          "mediaItem": {
            "id": "media-008",
            "mediaType": "image",
            "description": "Muscle-Up Transition",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-005",
            "description": "Complete 4 sets of low-bar transition drills.",
            "mediaItem": {
              "id": "media-009",
              "mediaType": "image",
              "description": "Low-Bar Transition Drill",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-006",
            "description": "Film 3 attempts and review elbow path.",
            "mediaItem": {
              "id": "media-010",
              "mediaType": "image",
              "description": "Muscle-up elbow path reference",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-109",
            "description": "Hold false-grip support for 20 seconds",
            "mediaItem": {
              "id": "media-062",
              "mediaType": "image",
              "description": "False-grip support hold",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          }
        ],
        "signals": [
          {
            "signalId": "signal-003",
            "title": "Band-assisted muscle-ups",
            "description": "Clean assisted reps",
            "order": "increasing",
            "targetValue": 5,
            "minValue": 0,
            "maxValue": 6,
            "unit": "reps",
            "dimension": "execution"
          },
          {
            "signalId": "signal-003-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-003-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-004",
        "title": "Week 4",
        "subtitle": "Attempt clean singles",
        "suggestedTargetDate": "2026-05-24",
        "intro": {
          "description": "Bring the pieces together with controlled singles and good recovery between attempts.",
          "mediaItem": {
            "id": "media-011",
            "mediaType": "image",
            "description": "Clean Bar Muscle-Up Example",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-007",
            "description": "Attempt 6 controlled muscle-up singles",
            "mediaItem": {
              "id": "media-012",
              "mediaType": "image",
              "description": "Single Attempt Checklist",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-026",
            "description": "Warm up with explosive high pulls"
          },
          {
            "itemId": "item-027",
            "description": "Review one filmed attempt with a teammate."
          }
        ],
        "signals": [
          {
            "signalId": "signal-004",
            "title": "Clean muscle-up attempts",
            "description": "Successful clean reps",
            "order": "increasing",
            "targetValue": 1,
            "minValue": 0,
            "maxValue": 2,
            "unit": "reps",
            "dimension": "execution"
          },
          {
            "signalId": "signal-004-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-004-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-002",
    "title": "Explosive Lower Body Power",
    "category": "gym",
    "cards": [
      {
        "cardId": "card-005",
        "title": "Week 1",
        "subtitle": "Establish squat strength baseline",
        "suggestedTargetDate": "2026-03-22",
        "intro": {
          "description": "Build a safe baseline with controlled squats and jumping mechanics.",
          "mediaItem": {
            "id": "media-013",
            "mediaType": "image",
            "description": "Squat Baseline Session",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-008",
            "description": "Test 5-rep back squat at controlled depth.",
            "mediaItem": {
              "id": "media-014",
              "mediaType": "image",
              "description": "Back squat depth reference",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-028",
            "description": "Record 3 countermovement jumps"
          },
          {
            "itemId": "item-029",
            "description": "Log warm-up loads and RPE notes"
          }
        ],
        "signals": [
          {
            "signalId": "signal-005",
            "title": "Back squat 5RM",
            "description": "Best controlled 5-rep set",
            "order": "increasing",
            "targetValue": 90,
            "minValue": 0,
            "maxValue": 108,
            "unit": "kg",
            "dimension": "stability"
          },
          {
            "signalId": "signal-005-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-005-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-006",
        "title": "Week 2",
        "subtitle": "Introduce loaded jumps",
        "suggestedTargetDate": "2026-03-29",
        "intro": {
          "description": "Convert gym strength into explosive output with lighter, faster movements.",
          "mediaItem": {
            "id": "media-015",
            "mediaType": "image",
            "description": "Trap Bar Jump Technique",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-009",
            "description": "Complete 5 sets of 3 trap-bar jumps.",
            "mediaItem": {
              "id": "media-016",
              "mediaType": "image",
              "description": "Explosive Jump Cue",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-030",
            "description": "Pair jumps with acceleration mechanics"
          },
          {
            "itemId": "item-031",
            "description": "Upload one slow-motion jump clip for landing review."
          }
        ],
        "signals": [
          {
            "signalId": "signal-006",
            "title": "Standing vertical jump",
            "description": "Best jump height",
            "order": "increasing",
            "targetValue": 51,
            "minValue": 0,
            "maxValue": 62,
            "unit": "cm",
            "dimension": "execution"
          },
          {
            "signalId": "signal-006-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-006-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-007",
        "title": "Week 3",
        "subtitle": "Single-leg force production",
        "suggestedTargetDate": "2026-04-05",
        "intro": {
          "description": "Focus on unilateral strength for sprinting, cutting and balance in duels.",
          "mediaItem": {
            "id": "media-017",
            "mediaType": "image",
            "description": "Bulgarian split squat setup",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-010",
            "description": "Complete split squats each leg",
            "mediaItem": {
              "id": "media-018",
              "mediaType": "image",
              "description": "Split Squat Form",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-032",
            "description": "Add single-leg pogos for 3 sets of 20 contacts."
          },
          {
            "itemId": "item-033",
            "description": "Compare left and right leg jump quality from video."
          }
        ],
        "signals": [
          {
            "signalId": "signal-007",
            "title": "Split squat load",
            "description": "Dumbbell load per hand for working sets",
            "order": "increasing",
            "targetValue": 24,
            "minValue": 0,
            "maxValue": 29,
            "unit": "kg",
            "dimension": "adaptation"
          },
          {
            "signalId": "signal-007-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-007-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-008",
        "title": "Week 4",
        "subtitle": "Retest and consolidate",
        "suggestedTargetDate": "2026-04-12",
        "intro": {
          "description": "Finish the block by retesting jump output and squat strength.",
          "mediaItem": {
            "id": "media-019",
            "mediaType": "image",
            "description": "Lower Body Power Retest",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-011",
            "description": "Retest standing vertical jump after warm-up.",
            "mediaItem": {
              "id": "media-020",
              "mediaType": "image",
              "description": "Vertical jump measurement",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-034",
            "description": "Retest 5-rep squat at controlled depth."
          },
          {
            "itemId": "item-035",
            "description": "Write one recovery and training note"
          }
        ],
        "signals": [
          {
            "signalId": "signal-008",
            "title": "Standing vertical jump",
            "description": "Best retest jump height",
            "order": "increasing",
            "targetValue": 53,
            "minValue": 0,
            "maxValue": 65,
            "unit": "cm",
            "dimension": "execution"
          },
          {
            "signalId": "signal-008-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-008-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-003",
    "title": "Sharper First Touch Under Pressure",
    "category": "football",
    "cards": [
      {
        "cardId": "card-009",
        "title": "Week 1",
        "subtitle": "Clean receiving mechanics",
        "suggestedTargetDate": "2026-04-27",
        "intro": {
          "description": "Improve body shape before receiving and make the first touch more purposeful.",
          "mediaItem": {
            "id": "media-021",
            "mediaType": "image",
            "description": "Receiving Body Shape",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-012",
            "description": "Complete 100 wall passes using two-touch control.",
            "mediaItem": {
              "id": "media-022",
              "mediaType": "image",
              "description": "Two-Touch Wall Passing",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-036",
            "description": "Film 20 receives with body shape open to the pitch."
          },
          {
            "itemId": "item-037",
            "description": "Log 5 touches that opened the pass"
          }
        ],
        "signals": [
          {
            "signalId": "signal-009",
            "title": "Clean first touches",
            "description": "Clean touches out of 50 attempts",
            "order": "increasing",
            "targetValue": 40,
            "minValue": 0,
            "maxValue": 48,
            "unit": "touches",
            "dimension": "execution"
          },
          {
            "signalId": "signal-009-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-009-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-010",
        "title": "Week 2",
        "subtitle": "Scan before receiving",
        "suggestedTargetDate": "2026-05-04",
        "intro": {
          "description": "Add scanning before the ball arrives so the first touch matches the next action.",
          "mediaItem": {
            "id": "media-023",
            "mediaType": "image",
            "description": "Scanning Before Receiving",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-013",
            "description": "Review 3 scanning rondo clips",
            "mediaItem": {
              "id": "media-024",
              "mediaType": "image",
              "description": "Rondo Scanning Drill",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-038",
            "description": "Add shoulder checks before receiving"
          },
          {
            "itemId": "item-039",
            "description": "React to teammate colour calls"
          }
        ],
        "signals": [
          {
            "signalId": "signal-010",
            "title": "Pre-receive scans",
            "description": "Average scans before receiving in drill",
            "order": "increasing",
            "targetValue": 1.3,
            "minValue": 0,
            "maxValue": 2,
            "unit": "scans",
            "dimension": "reflection"
          },
          {
            "signalId": "signal-010-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-010-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-011",
        "title": "Week 3",
        "subtitle": "Receive on the half-turn",
        "suggestedTargetDate": "2026-05-11",
        "intro": {
          "description": "Focus on opening your hips and receiving across your body to play forward sooner.",
          "mediaItem": {
            "id": "media-025",
            "mediaType": "image",
            "description": "Receiving on the Half-Turn",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-014",
            "description": "Complete 60 half-turn receives from both sides.",
            "mediaItem": {
              "id": "media-026",
              "mediaType": "image",
              "description": "Half-turn receiving body shape",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-040",
            "description": "Complete 20 half-turn exits into a forward pass."
          },
          {
            "itemId": "item-041",
            "description": "Review one touch that opened play"
          }
        ],
        "signals": [
          {
            "signalId": "signal-011",
            "title": "Forward exits",
            "description": "Successful forward first touches out of 40",
            "order": "increasing",
            "targetValue": 30,
            "minValue": 0,
            "maxValue": 36,
            "unit": "touches",
            "dimension": "execution"
          },
          {
            "signalId": "signal-011-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-011-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-012",
        "title": "Week 4",
        "subtitle": "Pressure touch and release",
        "suggestedTargetDate": "2026-05-18",
        "intro": {
          "description": "Move from isolated work to receiving under contact pressure and playing quickly.",
          "mediaItem": {
            "id": "media-027",
            "mediaType": "image",
            "description": "Pressure Touch and Release",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-015",
            "description": "Complete pressure receiving rounds",
            "mediaItem": {
              "id": "media-028",
              "mediaType": "image",
              "description": "Pressure Receiving Drill",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-042",
            "description": "Complete two rounds with contact pressure from behind."
          },
          {
            "itemId": "item-043",
            "description": "Clip 3 pressure first-touch moments"
          }
        ],
        "signals": [
          {
            "signalId": "signal-012",
            "title": "Turnovers under pressure",
            "description": "Lost possessions in pressure drill",
            "order": "decreasing",
            "targetValue": 4,
            "minValue": 0,
            "maxValue": 12,
            "unit": "turnovers",
            "dimension": "adaptation"
          },
          {
            "signalId": "signal-012-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-012-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-013",
        "title": "Week 5",
        "subtitle": "Apply it in match actions",
        "suggestedTargetDate": "2026-05-25",
        "intro": {
          "description": "Track first-touch decisions in a real match or full training game.",
          "mediaItem": {
            "id": "media-029",
            "mediaType": "image",
            "description": "Match first-touch review template",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-016",
            "description": "Clip 5 first touches that created space",
            "mediaItem": {
              "id": "media-030",
              "mediaType": "image",
              "description": "Clip Review Guide",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-044",
            "description": "Track first-touch decisions in one full training game."
          },
          {
            "itemId": "item-045",
            "description": "Share two positive first-touch clips with the group."
          }
        ],
        "signals": [
          {
            "signalId": "signal-013",
            "title": "Positive first touches",
            "description": "First touches that improve the next action",
            "order": "increasing",
            "targetValue": 18,
            "minValue": 0,
            "maxValue": 22,
            "unit": "actions",
            "dimension": "execution"
          },
          {
            "signalId": "signal-013-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-013-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-023",
        "title": "Week 6",
        "subtitle": "Retain first touch quality under fatigue",
        "suggestedTargetDate": "2026-06-01",
        "intro": {
          "description": "Finish the block by checking whether scanning, body shape and first-touch choices hold late in training.",
          "mediaItem": {
            "id": "media-049",
            "mediaType": "image",
            "description": "First Touch Under Fatigue",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-046",
            "description": "Complete post-conditioning receiving"
          },
          {
            "itemId": "item-047",
            "description": "Compare late touches with Week 1"
          },
          {
            "itemId": "item-048",
            "description": "Write one first-touch match target"
          }
        ],
        "signals": [
          {
            "signalId": "signal-023",
            "title": "Late-session clean touches",
            "description": "Clean first touches after fatigue block",
            "order": "increasing",
            "targetValue": 30,
            "minValue": 0,
            "maxValue": 36,
            "unit": "touches",
            "dimension": "recovery"
          },
          {
            "signalId": "signal-023-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-023-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-004",
    "title": "Lean Strength Block",
    "category": "gym",
    "cards": [
      {
        "cardId": "card-014",
        "title": "Week 1",
        "subtitle": "Set nutrition and lifting baseline",
        "suggestedTargetDate": "2026-05-05",
        "intro": {
          "description": "Establish consistent protein intake and controlled strength sessions without overdoing volume.",
          "mediaItem": {
            "id": "media-031",
            "mediaType": "image",
            "description": "Lean strength training overview",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-017",
            "description": "Track protein intake for 7 days.",
            "mediaItem": {
              "id": "media-032",
              "mediaType": "image",
              "description": "Protein tracking template",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-049",
            "description": "Complete two controlled full-body lifting sessions."
          },
          {
            "itemId": "item-050",
            "description": "Set a sleep and hydration target for the block."
          }
        ],
        "signals": [
          {
            "signalId": "signal-014",
            "title": "Average daily protein",
            "description": "Protein intake across the week",
            "order": "increasing",
            "targetValue": 120,
            "minValue": 0,
            "maxValue": 150,
            "unit": "g",
            "dimension": "execution"
          },
          {
            "signalId": "signal-014-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-014-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-015",
        "title": "Week 2",
        "subtitle": "Upper-body strength and posture",
        "suggestedTargetDate": "2026-05-12",
        "intro": {
          "description": "Build pressing and pulling strength while keeping shoulder health in mind.",
          "mediaItem": {
            "id": "media-033",
            "mediaType": "image",
            "description": "Upper Strength Week",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-018",
            "description": "Match bench and row volume",
            "mediaItem": {
              "id": "media-034",
              "mediaType": "image",
              "description": "Row Technique",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-051",
            "description": "Add shoulder prehab work after each upper-body lift."
          },
          {
            "itemId": "item-052",
            "description": "Record posture check photos before and after the week."
          }
        ],
        "signals": [
          {
            "signalId": "signal-015",
            "title": "Bench press working weight",
            "description": "Top set of 6 reps",
            "order": "increasing",
            "targetValue": 67.5,
            "minValue": 0,
            "maxValue": 81,
            "unit": "kg",
            "dimension": "execution"
          },
          {
            "signalId": "signal-015-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-015-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-016",
        "title": "Week 3",
        "subtitle": "Conditioning without losing strength",
        "suggestedTargetDate": "2026-05-19",
        "intro": {
          "description": "Add short conditioning work while keeping gym performance stable.",
          "mediaItem": {
            "id": "media-035",
            "mediaType": "image",
            "description": "Conditioning Finishers",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-019",
            "description": "Complete 2 short conditioning finishers",
            "mediaItem": {
              "id": "media-036",
              "mediaType": "image",
              "description": "Conditioning finisher board",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-053",
            "description": "Hit all lower-body target loads"
          },
          {
            "itemId": "item-054",
            "description": "Log body weight and readiness across three mornings."
          }
        ],
        "signals": [
          {
            "signalId": "signal-016",
            "title": "Resting body weight",
            "description": "Average morning weight",
            "order": "decreasing",
            "targetValue": 75.5,
            "minValue": 72,
            "maxValue": 76.8,
            "unit": "kg",
            "dimension": "execution"
          },
          {
            "signalId": "signal-016-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-016-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-017",
        "title": "Week 4",
        "subtitle": "Strength retention check",
        "suggestedTargetDate": "2026-05-26",
        "intro": {
          "description": "Check whether strength is holding while body composition improves.",
          "mediaItem": {
            "id": "media-037",
            "mediaType": "image",
            "description": "Strength retention checklist",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-020",
            "description": "Retest main lifts at submaximal effort.",
            "mediaItem": {
              "id": "media-038",
              "mediaType": "image",
              "description": "Submax Retest",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-055",
            "description": "Compare Week 1 and Week 4 pull-up quality."
          },
          {
            "itemId": "item-056",
            "description": "Write one maintenance target for the next block."
          }
        ],
        "signals": [
          {
            "signalId": "signal-017",
            "title": "Pull-ups at bodyweight",
            "description": "Max clean reps",
            "order": "increasing",
            "targetValue": 10,
            "minValue": 0,
            "maxValue": 12,
            "unit": "reps",
            "dimension": "execution"
          },
          {
            "signalId": "signal-017-confidence",
            "title": "Movement confidence",
            "description": "How settled the movement pattern felt this week",
            "order": "increasing",
            "targetValue": 4.3,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-017-load",
            "title": "Load tolerance",
            "description": "Capacity to absorb the week's training load",
            "order": "increasing",
            "targetValue": 145,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-005",
    "title": "Beating a Full-Back 1v1",
    "category": "football",
    "cards": [
      {
        "cardId": "card-018",
        "title": "Week 1",
        "subtitle": "Change of pace basics",
        "suggestedTargetDate": "2026-05-01",
        "intro": {
          "description": "Build the habit of slowing the defender down before exploding past them.",
          "mediaItem": {
            "id": "media-039",
            "mediaType": "image",
            "description": "Change of Pace 1v1",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-021",
            "description": "Complete 30 slow-fast dribble reps each side.",
            "mediaItem": {
              "id": "media-040",
              "mediaType": "image",
              "description": "Slow-fast dribble cone setup",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-057",
            "description": "Film 10 take-ons showing the speed change."
          },
          {
            "itemId": "item-058",
            "description": "Use the move twice in a small-sided game."
          }
        ],
        "signals": [
          {
            "signalId": "signal-018",
            "title": "Successful take-ons",
            "description": "Successful 1v1s in training game",
            "order": "increasing",
            "targetValue": 5,
            "minValue": 0,
            "maxValue": 6,
            "unit": "take-ons",
            "dimension": "execution"
          },
          {
            "signalId": "signal-018-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-018-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-019",
        "title": "Week 2",
        "subtitle": "Body feints and disguise",
        "suggestedTargetDate": "2026-05-08",
        "intro": {
          "description": "Use shoulders, hips and eyes to move the defender before touching the ball past them.",
          "mediaItem": {
            "id": "media-041",
            "mediaType": "image",
            "description": "Body Feints for Wide Players",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-022",
            "description": "Practise 40 body feints into outside acceleration.",
            "mediaItem": {
              "id": "media-042",
              "mediaType": "image",
              "description": "Body Feint Outside Push",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-059",
            "description": "Complete 20 feints into inside carries."
          },
          {
            "itemId": "item-060",
            "description": "Clip one defender biting on the feint"
          }
        ],
        "signals": [
          {
            "signalId": "signal-019",
            "title": "Defender wrong-footed",
            "description": "Times defender shifts weight before touch",
            "order": "increasing",
            "targetValue": 8,
            "minValue": 0,
            "maxValue": 10,
            "unit": "actions",
            "dimension": "execution"
          },
          {
            "signalId": "signal-019-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-019-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-020",
        "title": "Week 3",
        "subtitle": "Attack both sides",
        "suggestedTargetDate": "2026-05-15",
        "intro": {
          "description": "Stop becoming predictable by threatening inside and outside with equal confidence.",
          "mediaItem": {
            "id": "media-043",
            "mediaType": "image",
            "description": "Inside and Outside Threat",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-023",
            "description": "Mix inside cuts and outside bursts",
            "mediaItem": {
              "id": "media-044",
              "mediaType": "image",
              "description": "Winger 1v1 lane setup",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-061",
            "description": "Use three weaker-side attacks in a possession game."
          },
          {
            "itemId": "item-062",
            "description": "Review whether the defender over-protects one side."
          }
        ],
        "signals": [
          {
            "signalId": "signal-020",
            "title": "Inside/outside balance",
            "description": "Percentage of attacks going weaker side",
            "order": "increasing",
            "targetValue": 45,
            "minValue": 0,
            "maxValue": 100,
            "unit": "%",
            "dimension": "stability"
          },
          {
            "signalId": "signal-020-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-020-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-021",
        "title": "Week 4",
        "subtitle": "End product after the take-on",
        "suggestedTargetDate": "2026-05-22",
        "intro": {
          "description": "The goal is not just beating the defender — it is creating a shot, cross or cutback after it.",
          "mediaItem": {
            "id": "media-045",
            "mediaType": "image",
            "description": "End Product After 1v1",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-024",
            "description": "Complete 25 take-on into cutback reps.",
            "mediaItem": {
              "id": "media-046",
              "mediaType": "image",
              "description": "Cutback Repetition Drill",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-063",
            "description": "Hit five low crosses after beating a passive defender."
          },
          {
            "itemId": "item-064",
            "description": "Film two end-product reps from each side."
          }
        ],
        "signals": [
          {
            "signalId": "signal-021",
            "title": "Chance creation after take-on",
            "description": "Shots or dangerous passes after beating defender",
            "order": "increasing",
            "targetValue": 6,
            "minValue": 0,
            "maxValue": 8,
            "unit": "actions",
            "dimension": "execution"
          },
          {
            "signalId": "signal-021-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-021-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-022",
        "title": "Week 5",
        "subtitle": "Match application",
        "suggestedTargetDate": "2026-05-29",
        "intro": {
          "description": "Use match clips to review decision-making, timing and final action quality.",
          "mediaItem": {
            "id": "media-047",
            "mediaType": "image",
            "description": "1v1 match review sheet",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-025",
            "description": "Clip 5 1v1 moments from match or full training game.",
            "mediaItem": {
              "id": "media-048",
              "mediaType": "image",
              "description": "Match Clip Review",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "itemId": "item-065",
            "description": "Tag every 1v1 as inside, outside or recycle."
          },
          {
            "itemId": "item-066",
            "description": "Choose one decision-making target for the next match."
          }
        ],
        "signals": [
          {
            "signalId": "signal-022",
            "title": "Effective 1v1 actions",
            "description": "Take-ons leading to advantage",
            "order": "increasing",
            "targetValue": 7,
            "minValue": 0,
            "maxValue": 9,
            "unit": "actions",
            "dimension": "execution"
          },
          {
            "signalId": "signal-022-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-022-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-006",
    "title": "10 Week Performance Test",
    "category": "football",
    "cards": [
      {
        "cardId": "card-024",
        "title": "Week 1",
        "subtitle": "Acceleration baseline",
        "suggestedTargetDate": "2026-06-03",
        "intro": {
          "description": "Establish first-step speed, sprint posture and repeatable acceleration markers.",
          "mediaItem": {
            "id": "media-card-024-intro",
            "mediaType": "image",
            "description": "Week 1",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-067",
            "description": "Record 3 10-metre sprint times"
          },
          {
            "itemId": "item-068",
            "description": "Film 2 starts from side angle"
          },
          {
            "itemId": "item-069",
            "description": "Log best time and recovery gaps"
          }
        ],
        "signals": [
          {
            "signalId": "signal-024",
            "title": "10m sprint",
            "description": "Best acceleration time",
            "order": "decreasing",
            "targetValue": 1.85,
            "minValue": 1.6,
            "maxValue": 5,
            "unit": "s",
            "dimension": "execution"
          },
          {
            "signalId": "signal-024-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-024-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-025",
        "title": "Week 2",
        "subtitle": "Repeat sprint quality",
        "suggestedTargetDate": "2026-06-10",
        "intro": {
          "description": "Improve the ability to repeat high-quality sprints with consistent recovery and technique.",
          "mediaItem": {
            "id": "media-card-025-intro",
            "mediaType": "image",
            "description": "Week 2",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-071",
            "description": "Complete repeat 20-metre sprints"
          },
          {
            "itemId": "item-072",
            "description": "Track drop-off between fastest and slowest sprint."
          },
          {
            "itemId": "item-073",
            "description": "Review posture under fatigue"
          }
        ],
        "signals": [
          {
            "signalId": "signal-025",
            "title": "Sprint drop-off",
            "description": "Difference across repeat sprint set",
            "order": "decreasing",
            "targetValue": 4,
            "minValue": 2,
            "maxValue": 30,
            "unit": "%",
            "dimension": "adaptation"
          },
          {
            "signalId": "signal-025-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-025-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-026",
        "title": "Week 3",
        "subtitle": "Change of direction entry",
        "suggestedTargetDate": "2026-06-17",
        "intro": {
          "description": "Build cleaner deceleration shapes before changing direction at speed.",
          "mediaItem": {
            "id": "media-card-026-intro",
            "mediaType": "image",
            "description": "Week 3",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-075",
            "description": "Complete decel entries each side"
          },
          {
            "itemId": "item-076",
            "description": "Film front-on foot placement"
          },
          {
            "itemId": "item-077",
            "description": "Add ball-carry exits after decels"
          }
        ],
        "signals": [
          {
            "signalId": "signal-026",
            "title": "Clean COD entries",
            "description": "Controlled entries out of 20 reps",
            "order": "increasing",
            "targetValue": 16,
            "minValue": 0,
            "maxValue": 20,
            "unit": "reps",
            "dimension": "stability"
          },
          {
            "signalId": "signal-026-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-026-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-027",
        "title": "Week 4",
        "subtitle": "Strength support",
        "suggestedTargetDate": "2026-06-24",
        "intro": {
          "description": "Support on-pitch speed with lower-body strength, trunk control and hamstring robustness.",
          "mediaItem": {
            "id": "media-card-027-intro",
            "mediaType": "image",
            "description": "Week 4",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-079",
            "description": "Complete trap-bar and split squat sets"
          },
          {
            "itemId": "item-080",
            "description": "Add Copenhagen plank holds after the main lift."
          },
          {
            "itemId": "item-081",
            "description": "Complete Nordic hamstring progressions"
          }
        ],
        "signals": [
          {
            "signalId": "signal-027",
            "title": "Split squat load",
            "description": "Top working set per hand",
            "order": "increasing",
            "targetValue": 28,
            "minValue": 0,
            "maxValue": 34,
            "unit": "kg",
            "dimension": "adaptation"
          },
          {
            "signalId": "signal-027-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-027-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-028",
        "title": "Week 5",
        "subtitle": "High-speed ball carries",
        "suggestedTargetDate": "2026-07-01",
        "intro": {
          "description": "Connect sprint mechanics to carrying the ball at pace without losing control.",
          "mediaItem": {
            "id": "media-card-028-intro",
            "mediaType": "image",
            "description": "Week 5",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-083",
            "description": "Complete high-speed ball carries"
          },
          {
            "itemId": "item-084",
            "description": "Measure touch count during each carry."
          },
          {
            "itemId": "item-085",
            "description": "Film carries from behind"
          }
        ],
        "signals": [
          {
            "signalId": "signal-028",
            "title": "Controlled carries",
            "description": "Fast carries completed without heavy touch",
            "order": "increasing",
            "targetValue": 6,
            "minValue": 0,
            "maxValue": 8,
            "unit": "carries",
            "dimension": "stability"
          },
          {
            "signalId": "signal-028-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-028-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-029",
        "title": "Week 6",
        "subtitle": "Pressing repeatability",
        "suggestedTargetDate": "2026-07-08",
        "intro": {
          "description": "Test repeated pressing actions and recovery between high-intensity defensive efforts.",
          "mediaItem": {
            "id": "media-card-029-intro",
            "mediaType": "image",
            "description": "Week 6",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-087",
            "description": "Complete 6 pressing waves"
          },
          {
            "itemId": "item-088",
            "description": "Track first step and body angle"
          },
          {
            "itemId": "item-089",
            "description": "Clip one sharp press and one late press"
          }
        ],
        "signals": [
          {
            "signalId": "signal-029",
            "title": "Effective presses",
            "description": "Presses that force backward or rushed play",
            "order": "increasing",
            "targetValue": 8,
            "minValue": 0,
            "maxValue": 10,
            "unit": "presses",
            "dimension": "execution"
          },
          {
            "signalId": "signal-029-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-029-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-030",
        "title": "Week 7",
        "subtitle": "Power maintenance",
        "suggestedTargetDate": "2026-07-15",
        "intro": {
          "description": "Maintain jump and sprint qualities while training volume increases.",
          "mediaItem": {
            "id": "media-card-030-intro",
            "mediaType": "image",
            "description": "Week 7",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-091",
            "description": "Complete 2 low-volume jump sessions"
          },
          {
            "itemId": "item-092",
            "description": "Retest standing vertical jump after warm-up."
          },
          {
            "itemId": "item-093",
            "description": "Add sprint exposures after first lift"
          }
        ],
        "signals": [
          {
            "signalId": "signal-030",
            "title": "Vertical jump",
            "description": "Best weekly jump height",
            "order": "increasing",
            "targetValue": 55,
            "minValue": 0,
            "maxValue": 66,
            "unit": "cm",
            "dimension": "execution"
          },
          {
            "signalId": "signal-030-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-030-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-031",
        "title": "Week 8",
        "subtitle": "Match-speed decisions",
        "suggestedTargetDate": "2026-07-22",
        "intro": {
          "description": "Bring physical improvements into match-speed choices with and without the ball.",
          "mediaItem": {
            "id": "media-card-031-intro",
            "mediaType": "image",
            "description": "Week 8",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-095",
            "description": "Play 4v4 with sprint triggers"
          },
          {
            "itemId": "item-096",
            "description": "Track decisions after sprint actions"
          },
          {
            "itemId": "item-097",
            "description": "Clip one calm and one rushed choice"
          }
        ],
        "signals": [
          {
            "signalId": "signal-031",
            "title": "Positive transition decisions",
            "description": "Decisions after high-speed actions",
            "order": "increasing",
            "targetValue": 6,
            "minValue": 0,
            "maxValue": 8,
            "unit": "decisions",
            "dimension": "reflection"
          },
          {
            "signalId": "signal-031-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-031-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-032",
        "title": "Week 9",
        "subtitle": "Retest week",
        "suggestedTargetDate": "2026-07-29",
        "intro": {
          "description": "Retest sprint, jump and repeat-effort markers with clean recovery and consistent warm-up.",
          "mediaItem": {
            "id": "media-card-032-intro",
            "mediaType": "image",
            "description": "Week 9",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-099",
            "description": "Retest 10-metre sprint"
          },
          {
            "itemId": "item-100",
            "description": "Retest vertical jump and compare with Week 1."
          },
          {
            "itemId": "item-101",
            "description": "Complete one repeat sprint retest"
          }
        ],
        "signals": [
          {
            "signalId": "signal-032",
            "title": "Retest readiness",
            "description": "Completed retest components",
            "order": "increasing",
            "targetValue": 4,
            "minValue": 0,
            "maxValue": 5,
            "unit": "tests",
            "dimension": "recovery"
          },
          {
            "signalId": "signal-032-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-032-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      },
      {
        "cardId": "card-033",
        "title": "Week 10",
        "subtitle": "Performance review",
        "suggestedTargetDate": "2026-08-05",
        "intro": {
          "description": "Use the final week to review progress, pick the next focus and preserve the most useful routines.",
          "mediaItem": {
            "id": "media-card-033-intro",
            "mediaType": "image",
            "description": "Week 10",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        },
        "items": [
          {
            "itemId": "item-103",
            "description": "Choose 3 improved output clips"
          },
          {
            "itemId": "item-104",
            "description": "Compare Week 1 and Week 9 test numbers."
          },
          {
            "itemId": "item-105",
            "description": "Write the next 4-week priority"
          }
        ],
        "signals": [
          {
            "signalId": "signal-033",
            "title": "Review actions",
            "description": "Completed review tasks",
            "order": "increasing",
            "targetValue": 4,
            "minValue": 0,
            "maxValue": 5,
            "unit": "actions",
            "dimension": "reflection"
          },
          {
            "signalId": "signal-033-confidence",
            "title": "Confidence stability",
            "description": "Composure held across this week's technical work",
            "order": "increasing",
            "targetValue": 4.4,
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
            "dimension": "stability"
          },
          {
            "signalId": "signal-033-pressure",
            "title": "Pressure tolerance",
            "description": "Ability to keep shape and choice under pressure",
            "order": "increasing",
            "targetValue": 144,
            "minValue": 0,
            "maxValue": 180,
            "unit": "",
            "dimension": "adaptation"
          }
        ]
      }
    ]
  }
];
