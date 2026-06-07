import type { DeckTemplate } from "@/components/decks/types";

export const deckTemplates: DeckTemplate[] = [
  //PETER - JUNE
  {
    deckTemplateId: "deck-2026-06-open-loops-001",
    title: "Clear The Open Loops",
    category: "life-admin",
    channels: [
      {
        title: "Commitments",
        id: "commitments"
      },
      {
        title: "Foundations",
        id: "foundations"
      },
      {
        title: "Initiative",
        id: "initiative"
      }
    ],
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
        steps: [
          {
            stepId: "open-loops-item-001",
            description: "Build video app prototype and review with John"
          },
          {
            stepId: "open-loops-item-002",
            description: "Build a first financial projection through December"
          },
          {
            stepId: "open-loops-item-003",
            description: "Identify where you are currently avoiding outreach"
          }
        ],
        signals: [
          {
            signalId: "open-loops-signal-001",
            title: "John's App Clarity",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "open-loops-signal-002",
            title: "Financial Visibility",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "open-loops-signal-003",
            title: "Outreach Resistance",
            order: "decreasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
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
        steps: [
          {
            stepId: "open-loops-item-004",
            description: "Talk to your dad and make progress on summer plans"
          },
          {
            stepId: "open-loops-item-005",
            description: "Do priority admin and outstanding obligations"
          },
          {
            stepId: "open-loops-item-006",
            description: "Reach out to people connected to your existing goals and projects"
          }
        ],
        signals: [
          {
            signalId: "open-loops-signal-004",
            title: "Family Stability",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "open-loops-signal-005",
            title: "Admin Control",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "open-loops-signal-006",
            title: "People Contacted",
            order: "increasing",
            minValue: 0,
            maxValue: 5,
            isTheoreticalMin: true,
            isTheoreticalMax: true,
            unit: "people",
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
        steps: [
          {
            stepId: "open-loops-item-007",
            description: "Improve the video editing app with John and review progress together"
          },
          {
            stepId: "open-loops-item-008",
            description: "Clean flat, pack and get ready to move out"
          },
          {
            stepId: "open-loops-item-009",
            description: "Continue outreach and experiment with posting or sharing work publicly"
          }
        ],
        signals: [
          {
            signalId: "open-loops-signal-007",
            title: "Shared Momentum",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "open-loops-signal-008",
            title: "Move Readiness",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "open-loops-signal-009",
            title: "Outreach Rhythm",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
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
        steps: [
          {
            stepId: "open-loops-item-010",
            description: "Leave key family relationships stable and understood going into summer"
          },
          {
            stepId: "open-loops-item-011",
            description: "Finish June with clear financial visibility through December"
          },
          {
            stepId: "open-loops-item-012",
            description: "Make reaching out feel like a normal part of your work rather than something to avoid"
          }
        ],
        signals: [
          {
            signalId: "open-loops-signal-010",
            title: "Commitments Settled",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "open-loops-signal-011",
            title: "Life Foundations",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "open-loops-signal-012",
            title: "Initiative Confidence",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-teaching-income-001",
    title: "Create Teaching Income Option For September",
    category: "education",
    channels: [
      {
        title: "Teaching Registration",
        id: "teaching-registration"
      },
      {
        title: "Tutoring Presence",
        id: "tutoring-presence"
      },
      {
        title: "Maths Credibility",
        id: "maths-credibility"
      }
    ],
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
        steps: [
          {
            stepId: "teaching-item-001",
            description: "Begin registration, Garda and reference requirements"
          },
          {
            stepId: "teaching-item-002",
            description: "Research and select tutoring platforms"
          },
          {
            stepId: "teaching-item-003",
            description: "Plan the first maths lesson and activity"
          }
        ],
        signals: [
          {
            signalId: "teaching-signal-001",
            title: "Registration readiness",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "teaching-signal-002",
            title: "Tutoring foundations",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "teaching-signal-003",
            title: "Lesson progress",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 10,
            unit: "",
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
        steps: [
          {
            stepId: "teaching-item-004",
            description: "Complete registration and Garda requirements where possible"
          },
          {
            stepId: "teaching-item-005",
            description: "Create tutoring profiles and core information"
          },
          {
            stepId: "teaching-item-006",
            description: "Create the first maths video and accompanying activity"
          }
        ],
        signals: [
          {
            signalId: "teaching-signal-004",
            title: "Registration readiness",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "teaching-signal-005",
            title: "Tutoring foundations",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "teaching-signal-006",
            title: "Lesson progress",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 10,
            unit: "",
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
        steps: [
          {
            stepId: "teaching-item-007",
            description: "Reach out to schools and relevant contacts"
          },
          {
            stepId: "teaching-item-008",
            description: "Publish tutoring profiles and improve presentation"
          },
          {
            stepId: "teaching-item-009",
            description: "Publish the first maths lesson on the website"
          }
        ],
        signals: [
          {
            signalId: "teaching-signal-007",
            title: "School outreach",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "schools",
          },
          {
            signalId: "teaching-signal-008",
            title: "Active profiles",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 2,
            unit: "profiles",
          },
          {
            signalId: "teaching-signal-009",
            title: "Lesson completeness",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 10,
            unit: "",
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
        steps: [
          {
            stepId: "teaching-item-010",
            description: "Resolve remaining registration tasks and follow-ups"
          },
          {
            stepId: "teaching-item-011",
            description: "Refine profiles and research other avenues"
          },
          {
            stepId: "teaching-item-012",
            description: "Review what has been created and identify the next content priorities"
          }
        ],
        signals: [
          {
            signalId: "teaching-signal-010",
            title: "September readiness",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "teaching-signal-011",
            title: "Tutoring visibility",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "teaching-signal-012",
            title: "Teaching confidence",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-health-fitness-001",
    title: "Make Healthy Habits Feel Natural",
    category: "health-fitness",
    channels: [
      {
        title: "Awareness",
        id: "awareness"
      },
      {
        title: "Physical Capacity",
        id: "physical-capacity"
      },
      {
        title: "Recovery & Nutrition",
        id: "recovery-nutrition"
      }
    ],
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
        steps: [
          {
            stepId: "health-item-001",
            description: "Meditate on four days and establish a regular cue"
          },
          {
            stepId: "health-item-002",
            description: "Give core work and warm-ups greater attention in gym sessions"
          },
          {
            stepId: "health-item-003",
            description: "Organise shopping and meal preparation for the week ahead"
          }
        ],
        signals: [
          {
            signalId: "health-signal-001",
            title: "Meditation consistency",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 7,
            unit: "days",
          },
          {
            signalId: "health-signal-002",
            title: "Professional sessions",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "sessions",
          },
          {
            signalId: "health-signal-003",
            title: "Healthy days",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 7,
            unit: "days",
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
        steps: [
          {
            stepId: "health-item-004",
            description: "Meditate on most days of the week"
          },
          {
            stepId: "health-item-005",
            description: "Maintain a consistent gym routine while continuing the cut"
          },
          {
            stepId: "health-item-006",
            description: "Maintain healthy eating even during busy work periods"
          }
        ],
        signals: [
          {
            signalId: "health-signal-004",
            title: "Days without resistance",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 7,
            unit: "days",
          },
          {
            signalId: "health-signal-005",
            title: "Professional sessions",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "sessions",
          },
          {
            signalId: "health-signal-006",
            title: "Healthy days",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 7,
            unit: "days",
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
        steps: [
          {
            stepId: "health-item-007",
            description: "Lengthen meditation and improve quality of attention"
          },
          {
            stepId: "health-item-008",
            description: "Improve training quality through better pacing and execution"
          },
          {
            stepId: "health-item-009",
            description: "Maintain nutrition consistency through planning and preparation"
          }
        ],
        signals: [
          {
            signalId: "health-signal-007",
            title: "Quality of attention",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "health-signal-008",
            title: "Professional sessions",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "sessions",
          },
          {
            signalId: "health-signal-009",
            title: "Healthy days",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 7,
            unit: "days",
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
        steps: [
          {
            stepId: "health-item-010",
            description: "Let meditation become a normal part of daily life"
          },
          {
            stepId: "health-item-011",
            description: "Run a professional and sustainable training routine"
          },
          {
            stepId: "health-item-012",
            description: "Maintain nutrition and sleep without constant effort"
          }
        ],
        signals: [
          {
            signalId: "health-signal-010",
            title: "Meditation pull",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 7,
            unit: "days",
          },
          {
            signalId: "health-signal-011",
            title: "Professional sessions",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "sessions",
          },
          {
            signalId: "health-signal-012",
            title: "Healthy days",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 7,
            unit: "days",
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-tebo-studio-001",
    title: "Establish Tebo Studio As Credible",
    category: "tebo-studio",
    channels: [
      {
        title: "Opportunity Network",
        id: "opportunity-network"
      },
      {
        title: "Studio Credibility",
        id: "studio-credibility"
      },
      {
        title: "Studio Perspective",
        id: "studio-perspective"
      }
    ],
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
        steps: [
          {
            stepId: "tebo-item-001",
            description: "Identify and organise promising organisations and contacts"
          },
          {
            stepId: "tebo-item-002",
            description: "Complete Switchplay and Perfect Square project presentations"
          },
          {
            stepId: "tebo-item-003",
            description: "Extract and refine key data visualisation principles through the audit example"
          }
        ],
        signals: [
          {
            signalId: "tebo-signal-001",
            title: "Promising opportunities",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "tebo-signal-002",
            title: "Portfolio integration",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 2,
            unit: "",
          },
          {
            signalId: "tebo-signal-003",
            title: "Useful principles",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
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
        steps: [
          {
            stepId: "tebo-item-004",
            description: "Begin reaching out to selected contacts and organisations"
          },
          {
            stepId: "tebo-item-005",
            description: "Complete the Tebo Studio website and supporting pages"
          },
          {
            stepId: "tebo-item-006",
            description: "Integrate design principles into the website and audit example"
          }
        ],
        signals: [
          {
            signalId: "tebo-signal-004",
            title: "Positive responses",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "tebo-signal-005",
            title: "Website confidence",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "tebo-signal-006",
            title: "Principle confidence",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
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
        steps: [
          {
            stepId: "tebo-item-007",
            description: "Continue outreach and expand relevant contacts"
          },
          {
            stepId: "tebo-item-008",
            description: "Develop outreach messages using the website and portfolio"
          },
          {
            stepId: "tebo-item-009",
            description: "Observe which ideas and examples resonate most strongly"
          }
        ],
        signals: [
          {
            signalId: "tebo-signal-007",
            title: "Promising relationships",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "tebo-signal-008",
            title: "Message confidence",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "tebo-signal-009",
            title: "Perspective insights",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
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
        steps: [
          {
            stepId: "tebo-item-010",
            description: "Hold conversations with promising contacts and organisations"
          },
          {
            stepId: "tebo-item-011",
            description: "Refine outreach messaging based on responses and feedback"
          },
          {
            stepId: "tebo-item-012",
            description: "Clarify the strongest positioning emerging from conversations"
          }
        ],
        signals: [
          {
            signalId: "tebo-signal-010",
            title: "Emerging opportunities",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "tebo-signal-011",
            title: "Studio credibility",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "tebo-signal-012",
            title: "Positioning clarity",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-music-001",
    title: "Jam Freely With Fiddle And H90",
    category: "music",
    channels: [
      {
        title: "Scale Fluency",
        id: "scale-fluency"
      },
      {
        title: "Sound Shaping",
        id: "sound-shaping"
      },
      {
        title: "Trad Connections",
        id: "trad-connections"
      }
    ],
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
        steps: [
          { stepId: "music-item-001", description: "Expand scale fluency in third position" },
          { stepId: "music-item-002", description: "Learn how H90 presets are structured" },
          { stepId: "music-item-003", description: "Attend one trad session" }
        ],
        signals: [
          {
            signalId: "music-signal-001",
            title: "New scale patterns becoming usable",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 2,
            unit: "",
          },
          {
            signalId: "music-signal-002",
            title: "H90 controls understood",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "music-signal-003",
            title: "Meaningful trad encounters",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 2,
            unit: "",
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
        steps: [
          { stepId: "music-item-004", description: "Extend fluency into second and fourth positions" },
          { stepId: "music-item-005", description: "Begin shaping presets into my own sounds" },
          { stepId: "music-item-006", description: "Attend two trad sessions" }
        ],
        signals: [
          {
            signalId: "music-signal-004",
            title: "Scales becoming familiar",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 4,
            unit: "",
          },
          {
            signalId: "music-signal-005",
            title: "Presets successfully personalised",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 3,
            unit: "",
          },
          {
            signalId: "music-signal-006",
            title: "New musicians worth knowing",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 3,
            unit: "",
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
        steps: [
          { stepId: "music-item-007", description: "Connect scales and positions naturally" },
          { stepId: "music-item-008", description: "Make sound adjustments by ear" },
          { stepId: "music-item-009", description: "Attend three trad sessions" }
        ],
        signals: [
          {
            signalId: "music-signal-007",
            title: "Scales available instinctively",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "music-signal-008",
            title: "Personal sounds worth keeping",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 3,
            unit: "",
          },
          {
            signalId: "music-signal-009",
            title: "New strong musical connections",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 2,
            unit: "",
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
        steps: [
          { stepId: "music-item-010", description: "Jam freely across the neck" },
          { stepId: "music-item-011", description: "Develop sounds I genuinely rely on" },
          { stepId: "music-item-012", description: "Arrange future playing plans with new connections" }
        ],
        signals: [
          {
            signalId: "music-signal-010",
            title: "Scales I can jam with confidently",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 7,
            unit: "",
          },
          {
            signalId: "music-signal-011",
            title: "Sounds that feel uniquely mine",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 3,
            unit: "",
          },
          {
            signalId: "music-signal-012",
            title: "New musicians worth staying in touch with",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 3,
            unit: "",
          }
        ]
      }
    ]
  },
  {
    deckTemplateId: "deck-2026-06-switchplay-001",
    title: "Find Early Evidence For Switchplay",
    category: "switchplay",
    channels: [
      {
        title: "Product Robustness",
        id: "product-robustness"
      },
      {
        title: "User Validation",
        id: "user-validation"
      },
      {
        title: "Example Proof",
        id: "proof-through-examples"
      }
    ],
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
        steps: [
          {
            stepId: "switchplay-item-001",
            description: "Use Switchplay myself every day and note friction points"
          },
          {
            stepId: "switchplay-item-002",
            description: "Show Switchplay to early target users and gather first reactions"
          },
          {
            stepId: "switchplay-item-003",
            description: "Design the maths exemplar deck and supporting materials"
          }
        ],
        signals: [
          {
            signalId: "switchplay-signal-001",
            title: "Useful product insights",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "switchplay-signal-002",
            title: "Interest from target users",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "switchplay-signal-003",
            title: "Example concepts worth pursuing",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 3,
            unit: "",
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
        steps: [
          {
            stepId: "switchplay-item-004",
            description: "Fix the most important issues discovered through personal use"
          },
          {
            stepId: "switchplay-item-005",
            description: "Refine testing questions based on recurring reactions"
          },
          {
            stepId: "switchplay-item-006",
            description: "Film and build the maths exemplar deck"
          }
        ],
        signals: [
          {
            signalId: "switchplay-signal-004",
            title: "Important issues remaining",
            order: "decreasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "switchplay-signal-005",
            title: "Questions worth investigating",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "switchplay-signal-006",
            title: "Confidence in the maths exemplar",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
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
        steps: [
          {
            stepId: "switchplay-item-007",
            description: "Support three trial users through their first deck"
          },
          {
            stepId: "switchplay-item-008",
            description: "Test Switchplay with more target users and probe deeper issues"
          },
          {
            stepId: "switchplay-item-009",
            description: "Create one additional exemplar deck with a real participant"
          }
        ],
        signals: [
          {
            signalId: "switchplay-signal-007",
            title: "Successful user journeys",
            order: "increasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 3,
            unit: "",
          },
          {
            signalId: "switchplay-signal-008",
            title: "Most valuable discoveries",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "switchplay-signal-009",
            title: "Quality of content insights",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
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
        steps: [
          {
            stepId: "switchplay-item-010",
            description: "Fix issues and improve usability based on trial-user feedback"
          },
          {
            stepId: "switchplay-item-011",
            description: "Analyse patterns from all user conversations and trials"
          },
          {
            stepId: "switchplay-item-012",
            description: "Create one additional exemplar deck with a real participant"
          }
        ],
        signals: [
          {
            signalId: "switchplay-signal-010",
            title: "Issues blocking adoption",
            order: "decreasing",
            minValue: 0,
            isTheoreticalMin: true,
            maxValue: 5,
            unit: "",
          },
          {
            signalId: "switchplay-signal-011",
            title: "Confidence in the opportunity",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          },
          {
            signalId: "switchplay-signal-012",
            title: "Clarity about great Switchplay content",
            order: "increasing",
            minValue: 1,
            maxValue: 10,
            unit: "",
          }
        ]
      }
    ]
  },
  //MOCKS FROM HERE
  {
    "deckTemplateId": "deck-001",
    "title": "First Pull-Up to Clean Muscle-Up",
    "category": "calisthenics",
    "channels": [
      {
        "title": "Pull Strength",
        "id": "pull-strength"
      },
      {
        "title": "Movement Confidence",
        "id": "movement-confidence"
      },
      {
        "title": "Load Tolerance",
        "id": "load-tolerance"
      }
    ],
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
        "steps": [
          {
            "stepId": "item-001",
            "description": "Complete strict pull-up strength sets",
            "mediaItem": {
              "id": "media-002",
              "mediaType": "image",
              "description": "Strict pull-up form",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-002",
            "description": "Practise hollow-body holds for 3 sets of 30 seconds.",
            "mediaItem": {
              "id": "media-003",
              "mediaType": "image",
              "description": "Hollow Body Position",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-107",
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
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 9,
            "unit": "reps",
          },
          {
            "signalId": "signal-001-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-001-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-003",
            "description": "Complete 5 sets of chest-height pull-ups.",
            "mediaItem": {
              "id": "media-006",
              "mediaType": "image",
              "description": "Chest-to-Bar Pull-Up",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-004",
            "description": "Practise band-assisted transitions",
            "mediaItem": {
              "id": "media-007",
              "mediaType": "image",
              "description": "Band-assisted muscle-up transition",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-108",
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
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 6,
            "unit": "reps",
          },
          {
            "signalId": "signal-002-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-002-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-005",
            "description": "Complete 4 sets of low-bar transition drills.",
            "mediaItem": {
              "id": "media-009",
              "mediaType": "image",
              "description": "Low-Bar Transition Drill",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-006",
            "description": "Film 3 attempts and review elbow path.",
            "mediaItem": {
              "id": "media-010",
              "mediaType": "image",
              "description": "Muscle-up elbow path reference",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-109",
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
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 6,
            "unit": "reps",
          },
          {
            "signalId": "signal-003-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-003-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-007",
            "description": "Attempt 6 controlled muscle-up singles",
            "mediaItem": {
              "id": "media-012",
              "mediaType": "image",
              "description": "Single Attempt Checklist",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-026",
            "description": "Warm up with explosive high pulls"
          },
          {
            "stepId": "item-027",
            "description": "Review one filmed attempt with a teammate."
          }
        ],
        "signals": [
          {
            "signalId": "signal-004",
            "title": "Clean muscle-up attempts",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 2,
            "unit": "reps",
          },
          {
            "signalId": "signal-004-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-004-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-002",
    "title": "Explosive Lower Body Power",
    "category": "gym",
    "channels": [
      {
        "title": "Power Output",
        "id": "power-output"
      },
      {
        "title": "Movement Confidence",
        "id": "movement-confidence"
      },
      {
        "title": "Load Tolerance",
        "id": "load-tolerance"
      }
    ],
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
        "steps": [
          {
            "stepId": "item-008",
            "description": "Test 5-rep back squat at controlled depth.",
            "mediaItem": {
              "id": "media-014",
              "mediaType": "image",
              "description": "Back squat depth reference",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-028",
            "description": "Record 3 countermovement jumps"
          },
          {
            "stepId": "item-029",
            "description": "Log warm-up loads and RPE notes"
          }
        ],
        "signals": [
          {
            "signalId": "signal-005",
            "title": "Back squat 5RM",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 108,
            "unit": "kg",
          },
          {
            "signalId": "signal-005-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-005-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-009",
            "description": "Complete 5 sets of 3 trap-bar jumps.",
            "mediaItem": {
              "id": "media-016",
              "mediaType": "image",
              "description": "Explosive Jump Cue",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-030",
            "description": "Pair jumps with acceleration mechanics"
          },
          {
            "stepId": "item-031",
            "description": "Upload one slow-motion jump clip for landing review."
          }
        ],
        "signals": [
          {
            "signalId": "signal-006",
            "title": "Standing vertical jump",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 62,
            "unit": "cm",
          },
          {
            "signalId": "signal-006-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-006-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-010",
            "description": "Complete split squats each leg",
            "mediaItem": {
              "id": "media-018",
              "mediaType": "image",
              "description": "Split Squat Form",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-032",
            "description": "Add single-leg pogos for 3 sets of 20 contacts."
          },
          {
            "stepId": "item-033",
            "description": "Compare left and right leg jump quality from video."
          }
        ],
        "signals": [
          {
            "signalId": "signal-007",
            "title": "Split squat load",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 29,
            "unit": "kg",
          },
          {
            "signalId": "signal-007-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-007-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-011",
            "description": "Retest standing vertical jump after warm-up.",
            "mediaItem": {
              "id": "media-020",
              "mediaType": "image",
              "description": "Vertical jump measurement",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-034",
            "description": "Retest 5-rep squat at controlled depth."
          },
          {
            "stepId": "item-035",
            "description": "Write one recovery and training note"
          }
        ],
        "signals": [
          {
            "signalId": "signal-008",
            "title": "Standing vertical jump",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 65,
            "unit": "cm",
          },
          {
            "signalId": "signal-008-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-008-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-003",
    "title": "Sharper First Touch Under Pressure",
    "category": "football",
    "channels": [
      {
        "title": "First Touch",
        "id": "first-touch"
      },
      {
        "title": "Confidence Stability",
        "id": "confidence-stability"
      },
      {
        "title": "Pressure Tolerance",
        "id": "pressure-tolerance"
      }
    ],
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
        "steps": [
          {
            "stepId": "item-012",
            "description": "Complete 100 wall passes using two-touch control.",
            "mediaItem": {
              "id": "media-022",
              "mediaType": "image",
              "description": "Two-Touch Wall Passing",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-036",
            "description": "Film 20 receives with body shape open to the pitch."
          },
          {
            "stepId": "item-037",
            "description": "Log 5 touches that opened the pass"
          }
        ],
        "signals": [
          {
            "signalId": "signal-009",
            "title": "Clean first touches",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 48,
            "unit": "touches",
          },
          {
            "signalId": "signal-009-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-009-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-013",
            "description": "Review 3 scanning rondo clips",
            "mediaItem": {
              "id": "media-024",
              "mediaType": "image",
              "description": "Rondo Scanning Drill",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-038",
            "description": "Add shoulder checks before receiving"
          },
          {
            "stepId": "item-039",
            "description": "React to teammate colour calls"
          }
        ],
        "signals": [
          {
            "signalId": "signal-010",
            "title": "Pre-receive scans",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 2,
            "unit": "scans",
          },
          {
            "signalId": "signal-010-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-010-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-014",
            "description": "Complete 60 half-turn receives from both sides.",
            "mediaItem": {
              "id": "media-026",
              "mediaType": "image",
              "description": "Half-turn receiving body shape",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-040",
            "description": "Complete 20 half-turn exits into a forward pass."
          },
          {
            "stepId": "item-041",
            "description": "Review one touch that opened play"
          }
        ],
        "signals": [
          {
            "signalId": "signal-011",
            "title": "Forward exits",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 36,
            "unit": "touches",
          },
          {
            "signalId": "signal-011-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-011-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-015",
            "description": "Complete pressure receiving rounds",
            "mediaItem": {
              "id": "media-028",
              "mediaType": "image",
              "description": "Pressure Receiving Drill",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-042",
            "description": "Complete two rounds with contact pressure from behind."
          },
          {
            "stepId": "item-043",
            "description": "Clip 3 pressure first-touch moments"
          }
        ],
        "signals": [
          {
            "signalId": "signal-012",
            "title": "Turnovers under pressure",
            "order": "decreasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 12,
            "unit": "turnovers",
          },
          {
            "signalId": "signal-012-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-012-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-016",
            "description": "Clip 5 first touches that created space",
            "mediaItem": {
              "id": "media-030",
              "mediaType": "image",
              "description": "Clip Review Guide",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-044",
            "description": "Track first-touch decisions in one full training game."
          },
          {
            "stepId": "item-045",
            "description": "Share two positive first-touch clips with the group."
          }
        ],
        "signals": [
          {
            "signalId": "signal-013",
            "title": "Positive first touches",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 22,
            "unit": "actions",
          },
          {
            "signalId": "signal-013-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-013-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-046",
            "description": "Complete post-conditioning receiving"
          },
          {
            "stepId": "item-047",
            "description": "Compare late touches with Week 1"
          },
          {
            "stepId": "item-048",
            "description": "Write one first-touch match target"
          }
        ],
        "signals": [
          {
            "signalId": "signal-023",
            "title": "Late-session clean touches",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 36,
            "unit": "touches",
          },
          {
            "signalId": "signal-023-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-023-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-004",
    "title": "Lean Strength Block",
    "category": "gym",
    "channels": [
      {
        "title": "Strength Progress",
        "id": "strength-progress"
      },
      {
        "title": "Movement Confidence",
        "id": "movement-confidence"
      },
      {
        "title": "Load Tolerance",
        "id": "load-tolerance"
      }
    ],
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
        "steps": [
          {
            "stepId": "item-017",
            "description": "Track protein intake for 7 days.",
            "mediaItem": {
              "id": "media-032",
              "mediaType": "image",
              "description": "Protein tracking template",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-049",
            "description": "Complete two controlled full-body lifting sessions."
          },
          {
            "stepId": "item-050",
            "description": "Set a sleep and hydration target for the block."
          }
        ],
        "signals": [
          {
            "signalId": "signal-014",
            "title": "Average daily protein",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 150,
            "unit": "g",
          },
          {
            "signalId": "signal-014-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-014-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-018",
            "description": "Match bench and row volume",
            "mediaItem": {
              "id": "media-034",
              "mediaType": "image",
              "description": "Row Technique",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-051",
            "description": "Add shoulder prehab work after each upper-body lift."
          },
          {
            "stepId": "item-052",
            "description": "Record posture check photos before and after the week."
          }
        ],
        "signals": [
          {
            "signalId": "signal-015",
            "title": "Bench press working weight",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 81,
            "unit": "kg",
          },
          {
            "signalId": "signal-015-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-015-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-019",
            "description": "Complete 2 short conditioning finishers",
            "mediaItem": {
              "id": "media-036",
              "mediaType": "image",
              "description": "Conditioning finisher board",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-053",
            "description": "Hit all lower-body target loads"
          },
          {
            "stepId": "item-054",
            "description": "Log body weight and readiness across three mornings."
          }
        ],
        "signals": [
          {
            "signalId": "signal-016",
            "title": "Resting body weight",
            "order": "decreasing",
            "minValue": 72,
            "maxValue": 76.8,
            "unit": "kg",
          },
          {
            "signalId": "signal-016-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-016-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-020",
            "description": "Retest main lifts at submaximal effort.",
            "mediaItem": {
              "id": "media-038",
              "mediaType": "image",
              "description": "Submax Retest",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-055",
            "description": "Compare Week 1 and Week 4 pull-up quality."
          },
          {
            "stepId": "item-056",
            "description": "Write one maintenance target for the next block."
          }
        ],
        "signals": [
          {
            "signalId": "signal-017",
            "title": "Pull-ups at bodyweight",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 12,
            "unit": "reps",
          },
          {
            "signalId": "signal-017-confidence",
            "title": "Movement confidence",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-017-load",
            "title": "Load tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-005",
    "title": "Beating a Full-Back 1v1",
    "category": "football",
    "channels": [
      {
        "title": "Take-On Execution",
        "id": "take-on-execution"
      },
      {
        "title": "Confidence Stability",
        "id": "confidence-stability"
      },
      {
        "title": "Pressure Tolerance",
        "id": "pressure-tolerance"
      }
    ],
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
        "steps": [
          {
            "stepId": "item-021",
            "description": "Complete 30 slow-fast dribble reps each side.",
            "mediaItem": {
              "id": "media-040",
              "mediaType": "image",
              "description": "Slow-fast dribble cone setup",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-057",
            "description": "Film 10 take-ons showing the speed change."
          },
          {
            "stepId": "item-058",
            "description": "Use the move twice in a small-sided game."
          }
        ],
        "signals": [
          {
            "signalId": "signal-018",
            "title": "Successful take-ons",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 6,
            "unit": "take-ons",
          },
          {
            "signalId": "signal-018-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-018-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-022",
            "description": "Practise 40 body feints into outside acceleration.",
            "mediaItem": {
              "id": "media-042",
              "mediaType": "image",
              "description": "Body Feint Outside Push",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-059",
            "description": "Complete 20 feints into inside carries."
          },
          {
            "stepId": "item-060",
            "description": "Clip one defender biting on the feint"
          }
        ],
        "signals": [
          {
            "signalId": "signal-019",
            "title": "Defender wrong-footed",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 10,
            "unit": "actions",
          },
          {
            "signalId": "signal-019-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-019-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-023",
            "description": "Mix inside cuts and outside bursts",
            "mediaItem": {
              "id": "media-044",
              "mediaType": "image",
              "description": "Winger 1v1 lane setup",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-061",
            "description": "Use three weaker-side attacks in a possession game."
          },
          {
            "stepId": "item-062",
            "description": "Review whether the defender over-protects one side."
          }
        ],
        "signals": [
          {
            "signalId": "signal-020",
            "title": "Inside/outside balance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 100,
            "unit": "%",
          },
          {
            "signalId": "signal-020-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-020-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-024",
            "description": "Complete 25 take-on into cutback reps.",
            "mediaItem": {
              "id": "media-046",
              "mediaType": "image",
              "description": "Cutback Repetition Drill",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-063",
            "description": "Hit five low crosses after beating a passive defender."
          },
          {
            "stepId": "item-064",
            "description": "Film two end-product reps from each side."
          }
        ],
        "signals": [
          {
            "signalId": "signal-021",
            "title": "Chance creation after take-on",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 8,
            "unit": "actions",
          },
          {
            "signalId": "signal-021-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-021-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-025",
            "description": "Clip 5 1v1 moments from match or full training game.",
            "mediaItem": {
              "id": "media-048",
              "mediaType": "image",
              "description": "Match Clip Review",
              "src": "/images/media-traces/gym-trace-01.png"
            }
          },
          {
            "stepId": "item-065",
            "description": "Tag every 1v1 as inside, outside or recycle."
          },
          {
            "stepId": "item-066",
            "description": "Choose one decision-making target for the next match."
          }
        ],
        "signals": [
          {
            "signalId": "signal-022",
            "title": "Effective 1v1 actions",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 9,
            "unit": "actions",
          },
          {
            "signalId": "signal-022-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-022-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
          }
        ]
      }
    ]
  },
  {
    "deckTemplateId": "deck-006",
    "title": "10 Week Performance Test",
    "category": "football",
    "channels": [
      {
        "title": "Performance Output",
        "id": "performance-output"
      },
      {
        "title": "Confidence Stability",
        "id": "confidence-stability"
      },
      {
        "title": "Pressure Tolerance",
        "id": "pressure-tolerance"
      }
    ],
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
        "steps": [
          {
            "stepId": "item-067",
            "description": "Record 3 10-metre sprint times"
          },
          {
            "stepId": "item-068",
            "description": "Film 2 starts from side angle"
          },
          {
            "stepId": "item-069",
            "description": "Log best time and recovery gaps"
          }
        ],
        "signals": [
          {
            "signalId": "signal-024",
            "title": "10m sprint",
            "order": "decreasing",
            "minValue": 1.6,
            "maxValue": 5,
            "unit": "s",
          },
          {
            "signalId": "signal-024-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-024-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-071",
            "description": "Complete repeat 20-metre sprints"
          },
          {
            "stepId": "item-072",
            "description": "Track drop-off between fastest and slowest sprint."
          },
          {
            "stepId": "item-073",
            "description": "Review posture under fatigue"
          }
        ],
        "signals": [
          {
            "signalId": "signal-025",
            "title": "Sprint drop-off",
            "order": "decreasing",
            "minValue": 2,
            "maxValue": 30,
            "unit": "%",
          },
          {
            "signalId": "signal-025-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-025-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-075",
            "description": "Complete decel entries each side"
          },
          {
            "stepId": "item-076",
            "description": "Film front-on foot placement"
          },
          {
            "stepId": "item-077",
            "description": "Add ball-carry exits after decels"
          }
        ],
        "signals": [
          {
            "signalId": "signal-026",
            "title": "Clean COD entries",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 20,
            "unit": "reps",
          },
          {
            "signalId": "signal-026-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-026-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-079",
            "description": "Complete trap-bar and split squat sets"
          },
          {
            "stepId": "item-080",
            "description": "Add Copenhagen plank holds after the main lift."
          },
          {
            "stepId": "item-081",
            "description": "Complete Nordic hamstring progressions"
          }
        ],
        "signals": [
          {
            "signalId": "signal-027",
            "title": "Split squat load",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 34,
            "unit": "kg",
          },
          {
            "signalId": "signal-027-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-027-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-083",
            "description": "Complete high-speed ball carries"
          },
          {
            "stepId": "item-084",
            "description": "Measure touch count during each carry."
          },
          {
            "stepId": "item-085",
            "description": "Film carries from behind"
          }
        ],
        "signals": [
          {
            "signalId": "signal-028",
            "title": "Controlled carries",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 8,
            "unit": "carries",
          },
          {
            "signalId": "signal-028-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-028-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-087",
            "description": "Complete 6 pressing waves"
          },
          {
            "stepId": "item-088",
            "description": "Track first step and body angle"
          },
          {
            "stepId": "item-089",
            "description": "Clip one sharp press and one late press"
          }
        ],
        "signals": [
          {
            "signalId": "signal-029",
            "title": "Effective presses",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 10,
            "unit": "presses",
          },
          {
            "signalId": "signal-029-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-029-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-091",
            "description": "Complete 2 low-volume jump sessions"
          },
          {
            "stepId": "item-092",
            "description": "Retest standing vertical jump after warm-up."
          },
          {
            "stepId": "item-093",
            "description": "Add sprint exposures after first lift"
          }
        ],
        "signals": [
          {
            "signalId": "signal-030",
            "title": "Vertical jump",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 66,
            "unit": "cm",
          },
          {
            "signalId": "signal-030-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-030-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-095",
            "description": "Play 4v4 with sprint triggers"
          },
          {
            "stepId": "item-096",
            "description": "Track decisions after sprint actions"
          },
          {
            "stepId": "item-097",
            "description": "Clip one calm and one rushed choice"
          }
        ],
        "signals": [
          {
            "signalId": "signal-031",
            "title": "Positive transition decisions",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 8,
            "unit": "decisions",
          },
          {
            "signalId": "signal-031-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-031-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-099",
            "description": "Retest 10-metre sprint"
          },
          {
            "stepId": "item-100",
            "description": "Retest vertical jump and compare with Week 1."
          },
          {
            "stepId": "item-101",
            "description": "Complete one repeat sprint retest"
          }
        ],
        "signals": [
          {
            "signalId": "signal-032",
            "title": "Retest readiness",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 5,
            "unit": "tests",
          },
          {
            "signalId": "signal-032-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-032-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
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
        "steps": [
          {
            "stepId": "item-103",
            "description": "Choose 3 improved output clips"
          },
          {
            "stepId": "item-104",
            "description": "Compare Week 1 and Week 9 test numbers."
          },
          {
            "stepId": "item-105",
            "description": "Write the next 4-week priority"
          }
        ],
        "signals": [
          {
            "signalId": "signal-033",
            "title": "Review actions",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 5,
            "unit": "actions",
          },
          {
            "signalId": "signal-033-confidence",
            "title": "Confidence stability",
            "order": "increasing",
            "minValue": 1,
            "maxValue": 5,
            "unit": "",
          },
          {
            "signalId": "signal-033-pressure",
            "title": "Pressure tolerance",
            "order": "increasing",
            "minValue": 0,
            "isTheoreticalMin": true,
            "maxValue": 180,
            "unit": "",
          }
        ]
      }
    ]
  }
];
