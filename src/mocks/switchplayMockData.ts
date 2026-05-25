// Switchplay cards intentionally use exactly 3 primary progression items.
// This design constraint preserves clarity, calmness, and authored progression structure.
export const switchplayMockData = {
  "connections": [
    {
      "id": "user-002",
      "name": "Leo Murphy"
    },
    {
      "id": "user-003",
      "name": "Adam Walsh"
    },
    {
      "id": "user-004",
      "name": "Mason Kelly"
    },
    {
      "id": "user-005",
      "name": "Ryan Byrne"
    },
    {
      "id": "user-006",
      "name": "Noah Collins"
    }
  ],
  "user": {
    "id": "user-001",
    "name": "Jamie O'Brien",
    "decks": [
      {
        "id": "deck-001",
        "title": "First Pull-Up to Clean Muscle-Up",
        "category": "calisthenics",
        "status": "inProgress",
        "cards": [
          {
            "id": "card-001",
            "title": "Week 1",
            "subtitle": "Build strict pulling strength",
            "targetDate": "2026-05-03",
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
                "id": "item-001",
                "description": "Complete strict pull-up strength sets",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-002",
                  "mediaType": "image",
                  "description": "Strict pull-up form",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-002",
                "description": "Practise hollow-body holds for 3 sets of 30 seconds.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-003",
                  "mediaType": "image",
                  "description": "Hollow Body Position",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-107",
                "description": "Film one clean top-position hold",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-060",
                  "mediaType": "image",
                  "description": "Pull-up top hold",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-001",
                "title": "Strict pull-ups",
                "description": "Maximum clean reps in one set",
                "order": "increasing",
                "reading": 7,
                "targetValue": 7,
                "minValue": 0,
                "maxValue": 9,
                "unit": "reps",
                "dimension": "execution"
              },
              {
                "id": "stat-001-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 4.6,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-001-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 150,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": "Felt more controlled overall"
          },
          {
            "id": "card-002",
            "title": "Week 2",
            "subtitle": "Add explosive pulling",
            "targetDate": "2026-05-10",
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
                "id": "item-003",
                "description": "Complete 5 sets of chest-height pull-ups.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-006",
                  "mediaType": "image",
                  "description": "Chest-to-Bar Pull-Up",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-004",
                "description": "Practise band-assisted transitions",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-007",
                  "mediaType": "image",
                  "description": "Band-assisted muscle-up transition",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-108",
                "description": "Film 3 high pulls from side angle",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-061",
                  "mediaType": "image",
                  "description": "High Pull Side View",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-002",
                "title": "Chest-height pull-ups",
                "description": "Best set of explosive reps",
                "order": "increasing",
                "reading": 5,
                "targetValue": 5,
                "minValue": 0,
                "maxValue": 6,
                "unit": "reps",
                "dimension": "execution"
              },
              {
                "id": "stat-002-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 4.6,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-002-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 153,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-002-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-002",
                "comments": [
                  {
                    "id": "comment-card-002-1",
                    "creatorId": "user-003",
                    "createdAt": "2026-05-10T17:30:00Z",
                    "text": "Much calmer transition",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "Still rushing under fatigue"
          },
          {
            "id": "card-003",
            "title": "Week 3",
            "subtitle": "Control the transition",
            "targetDate": "2026-05-17",
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
                "id": "item-005",
                "description": "Complete 4 sets of low-bar transition drills.",
                "completionStatus": "inProgress",
                "mediaItem": {
                  "id": "media-009",
                  "mediaType": "image",
                  "description": "Low-Bar Transition Drill",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-006",
                "description": "Film 3 attempts and review elbow path.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-010",
                  "mediaType": "image",
                  "description": "Muscle-up elbow path reference",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-109",
                "description": "Hold false-grip support for 20 seconds",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-062",
                  "mediaType": "image",
                  "description": "False-grip support hold",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-003",
                "title": "Band-assisted muscle-ups",
                "description": "Clean assisted reps",
                "order": "increasing",
                "reading": 3,
                "targetValue": 5,
                "minValue": 0,
                "maxValue": 6,
                "unit": "reps",
                "dimension": "execution"
              },
              {
                "id": "stat-003-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 2.9,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-003-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 108,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-003-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              },
              {
                "id": "trace-card-003-2",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-003",
                "comments": [
                  {
                    "id": "comment-card-003-1",
                    "creatorId": "user-001",
                    "createdAt": "2026-05-17T17:30:00Z",
                    "text": "I felt that too",
                    "isRetained": true
                  },
                  {
                    "id": "comment-card-003-2",
                    "creatorId": "user-004",
                    "createdAt": "2026-05-17T18:30:00Z",
                    "text": "Touch looked cleaner",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "Closer than last week"
          },
          {
            "id": "card-004",
            "title": "Week 4",
            "subtitle": "Attempt clean singles",
            "targetDate": "2026-05-24",
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
                "id": "item-007",
                "description": "Attempt 6 controlled muscle-up singles",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-012",
                  "mediaType": "image",
                  "description": "Single Attempt Checklist",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-026",
                "description": "Warm up with explosive high pulls",
                "completionStatus": "todo"
              },
              {
                "id": "item-027",
                "description": "Review one filmed attempt with a teammate.",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-004",
                "title": "Clean muscle-up attempts",
                "description": "Successful clean reps",
                "order": "increasing",
                "reading": 0,
                "targetValue": 1,
                "minValue": 0,
                "maxValue": 2,
                "unit": "reps",
                "dimension": "execution"
              },
              {
                "id": "stat-004-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 2.6,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-004-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 93,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": ""
          }
        ]
      },
      {
        "id": "deck-002",
        "title": "Explosive Lower Body Power",
        "category": "gym",
        "status": "completed",
        "cards": [
          {
            "id": "card-005",
            "title": "Week 1",
            "subtitle": "Establish squat strength baseline",
            "targetDate": "2026-03-22",
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
                "id": "item-008",
                "description": "Test 5-rep back squat at controlled depth.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-014",
                  "mediaType": "image",
                  "description": "Back squat depth reference",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-028",
                "description": "Record 3 countermovement jumps",
                "completionStatus": "done"
              },
              {
                "id": "item-029",
                "description": "Log warm-up loads and RPE notes",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-005",
                "title": "Back squat 5RM",
                "description": "Best controlled 5-rep set",
                "order": "increasing",
                "reading": 90,
                "targetValue": 90,
                "minValue": 0,
                "maxValue": 108,
                "unit": "kg",
                "dimension": "stability"
              },
              {
                "id": "stat-005-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 4.6,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-005-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 150,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-005-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              },
              {
                "id": "trace-card-005-2",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              },
              {
                "id": "trace-card-005-3",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [],
            "reflection": ""
          },
          {
            "id": "card-006",
            "title": "Week 2",
            "subtitle": "Introduce loaded jumps",
            "targetDate": "2026-03-29",
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
                "id": "item-009",
                "description": "Complete 5 sets of 3 trap-bar jumps.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-016",
                  "mediaType": "image",
                  "description": "Explosive Jump Cue",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-030",
                "description": "Pair jumps with acceleration mechanics",
                "completionStatus": "done"
              },
              {
                "id": "item-031",
                "description": "Upload one slow-motion jump clip for landing review.",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-006",
                "title": "Standing vertical jump",
                "description": "Best jump height",
                "order": "increasing",
                "reading": 12,
                "targetValue": 51,
                "minValue": 0,
                "maxValue": 62,
                "unit": "cm",
                "dimension": "execution"
              },
              {
                "id": "stat-006-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 1.7,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-006-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 32,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-card-006",
                "comments": [
                  {
                    "id": "comment-card-006-1",
                    "creatorId": "user-002",
                    "createdAt": "2026-03-29T17:30:00Z",
                    "text": "Stronger first step",
                    "isRetained": false
                  }
                ]
              }
            ],
            "reflection": "Transition finally felt calmer"
          },
          {
            "id": "card-007",
            "title": "Week 3",
            "subtitle": "Single-leg force production",
            "targetDate": "2026-04-05",
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
                "id": "item-010",
                "description": "Complete split squats each leg",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-018",
                  "mediaType": "image",
                  "description": "Split Squat Form",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-032",
                "description": "Add single-leg pogos for 3 sets of 20 contacts.",
                "completionStatus": "done"
              },
              {
                "id": "item-033",
                "description": "Compare left and right leg jump quality from video.",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-007",
                "title": "Split squat load",
                "description": "Dumbbell load per hand for working sets",
                "order": "increasing",
                "reading": 24,
                "targetValue": 24,
                "minValue": 0,
                "maxValue": 29,
                "unit": "kg",
                "dimension": "adaptation"
              },
              {
                "id": "stat-007-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 4.6,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-007-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 156,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-007-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [],
            "reflection": "Need to trust first touch earlier"
          },
          {
            "id": "card-008",
            "title": "Week 4",
            "subtitle": "Retest and consolidate",
            "targetDate": "2026-04-12",
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
                "id": "item-011",
                "description": "Retest standing vertical jump after warm-up.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-020",
                  "mediaType": "image",
                  "description": "Vertical jump measurement",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-034",
                "description": "Retest 5-rep squat at controlled depth.",
                "completionStatus": "done"
              },
              {
                "id": "item-035",
                "description": "Write one recovery and training note",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-008",
                "title": "Standing vertical jump",
                "description": "Best retest jump height",
                "order": "increasing",
                "reading": 54,
                "targetValue": 53,
                "minValue": 0,
                "maxValue": 65,
                "unit": "cm",
                "dimension": "execution"
              },
              {
                "id": "stat-008-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 4.7,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-008-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 150,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-008-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              },
              {
                "id": "trace-card-008-2",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-008",
                "comments": [
                  {
                    "id": "comment-card-008-1",
                    "creatorId": "user-005",
                    "createdAt": "2026-04-12T17:30:00Z",
                    "text": "Better body shape",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "Reset and go again"
          }
        ]
      },
      {
        "id": "deck-003",
        "title": "Sharper First Touch Under Pressure",
        "category": "football",
        "status": "inProgress",
        "cards": [
          {
            "id": "card-009",
            "title": "Week 1",
            "subtitle": "Clean receiving mechanics",
            "targetDate": "2026-04-27",
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
                "id": "item-012",
                "description": "Complete 100 wall passes using two-touch control.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-022",
                  "mediaType": "image",
                  "description": "Two-Touch Wall Passing",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-036",
                "description": "Film 20 receives with body shape open to the pitch.",
                "completionStatus": "done"
              },
              {
                "id": "item-037",
                "description": "Log 5 touches that opened the pass",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-009",
                "title": "Clean first touches",
                "description": "Clean touches out of 50 attempts",
                "order": "increasing",
                "reading": 40,
                "targetValue": 40,
                "minValue": 0,
                "maxValue": 48,
                "unit": "touches",
                "dimension": "execution"
              },
              {
                "id": "stat-009-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 4.6,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-009-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 148,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-009",
                "comments": [
                  {
                    "id": "comment-009-001",
                    "creatorId": "user-006",
                    "createdAt": "2026-04-27T18:20:00Z",
                    "text": "Calmer receiving under pressure",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": ""
          },
          {
            "id": "card-010",
            "title": "Week 2",
            "subtitle": "Scan before receiving",
            "targetDate": "2026-05-04",
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
                "id": "item-013",
                "description": "Review 3 scanning rondo clips",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-024",
                  "mediaType": "image",
                  "description": "Rondo Scanning Drill",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-038",
                "description": "Add shoulder checks before receiving",
                "completionStatus": "done"
              },
              {
                "id": "item-039",
                "description": "React to teammate colour calls",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-010",
                "title": "Pre-receive scans",
                "description": "Average scans before receiving in drill",
                "order": "increasing",
                "reading": 1.4,
                "targetValue": 1.3,
                "minValue": 0,
                "maxValue": 2,
                "unit": "scans",
                "dimension": "reflection"
              },
              {
                "id": "stat-010-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 4.6,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-010-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 151,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-card-010",
                "comments": [
                  {
                    "id": "comment-card-010-1",
                    "creatorId": "user-006",
                    "createdAt": "2026-05-04T17:30:00Z",
                    "text": "More composed today",
                    "isRetained": true
                  },
                  {
                    "id": "comment-card-010-2",
                    "creatorId": "user-001",
                    "createdAt": "2026-05-04T18:30:00Z",
                    "text": "Still rushed late",
                    "isRetained": false
                  }
                ]
              }
            ],
            "reflection": "Rhythm came back late"
          },
          {
            "id": "card-011",
            "title": "Week 3",
            "subtitle": "Receive on the half-turn",
            "targetDate": "2026-05-11",
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
                "id": "item-014",
                "description": "Complete 60 half-turn receives from both sides.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-026",
                  "mediaType": "image",
                  "description": "Half-turn receiving body shape",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-040",
                "description": "Complete 20 half-turn exits into a forward pass.",
                "completionStatus": "done"
              },
              {
                "id": "item-041",
                "description": "Review one touch that opened play",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-011",
                "title": "Forward exits",
                "description": "Successful forward first touches out of 40",
                "order": "increasing",
                "reading": 29,
                "targetValue": 30,
                "minValue": 0,
                "maxValue": 36,
                "unit": "touches",
                "dimension": "execution"
              },
              {
                "id": "stat-011-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 4.7,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-011-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 154,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-011-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [],
            "reflection": "More composed overall"
          },
          {
            "id": "card-012",
            "title": "Week 4",
            "subtitle": "Pressure touch and release",
            "targetDate": "2026-05-18",
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
                "id": "item-015",
                "description": "Complete pressure receiving rounds",
                "completionStatus": "inProgress",
                "mediaItem": {
                  "id": "media-028",
                  "mediaType": "image",
                  "description": "Pressure Receiving Drill",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-042",
                "description": "Complete two rounds with contact pressure from behind.",
                "completionStatus": "done"
              },
              {
                "id": "item-043",
                "description": "Clip 3 pressure first-touch moments",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-012",
                "title": "Turnovers under pressure",
                "description": "Lost possessions in pressure drill",
                "order": "decreasing",
                "reading": 6,
                "targetValue": 4,
                "minValue": 0,
                "maxValue": 12,
                "unit": "turnovers",
                "dimension": "adaptation"
              },
              {
                "id": "stat-012-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 3.7,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-012-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 118,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-012-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              },
              {
                "id": "trace-card-012-2",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-012",
                "comments": [
                  {
                    "id": "comment-card-012-1",
                    "creatorId": "user-004",
                    "createdAt": "2026-05-18T17:30:00Z",
                    "text": "Rhythm improving",
                    "isRetained": false
                  }
                ]
              }
            ],
            "reflection": "Kept shape better today"
          },
          {
            "id": "card-013",
            "title": "Week 5",
            "subtitle": "Apply it in match actions",
            "targetDate": "2026-05-25",
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
                "id": "item-016",
                "description": "Clip 5 first touches that created space",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-030",
                  "mediaType": "image",
                  "description": "Clip Review Guide",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-044",
                "description": "Track first-touch decisions in one full training game.",
                "completionStatus": "todo"
              },
              {
                "id": "item-045",
                "description": "Share two positive first-touch clips with the group.",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-013",
                "title": "Positive first touches",
                "description": "First touches that improve the next action",
                "order": "increasing",
                "reading": 0,
                "targetValue": 18,
                "minValue": 0,
                "maxValue": 22,
                "unit": "actions",
                "dimension": "execution"
              },
              {
                "id": "stat-013-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 2.7,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-013-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 91,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": ""
          },
          {
            "id": "card-023",
            "title": "Week 6",
            "subtitle": "Retain first touch quality under fatigue",
            "targetDate": "2026-06-01",
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
                "id": "item-046",
                "description": "Complete post-conditioning receiving",
                "completionStatus": "todo"
              },
              {
                "id": "item-047",
                "description": "Compare late touches with Week 1",
                "completionStatus": "todo"
              },
              {
                "id": "item-048",
                "description": "Write one first-touch match target",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-023",
                "title": "Late-session clean touches",
                "description": "Clean first touches after fatigue block",
                "order": "increasing",
                "reading": 0,
                "targetValue": 30,
                "minValue": 0,
                "maxValue": 36,
                "unit": "touches",
                "dimension": "recovery"
              },
              {
                "id": "stat-023-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 2.7,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-023-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 94,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": ""
          }
        ]
      },
      {
        "id": "deck-004",
        "title": "Lean Strength Block",
        "category": "gym",
        "status": "inProgress",
        "cards": [
          {
            "id": "card-014",
            "title": "Week 1",
            "subtitle": "Set nutrition and lifting baseline",
            "targetDate": "2026-05-05",
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
                "id": "item-017",
                "description": "Track protein intake for 7 days.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-032",
                  "mediaType": "image",
                  "description": "Protein tracking template",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-049",
                "description": "Complete two controlled full-body lifting sessions.",
                "completionStatus": "done"
              },
              {
                "id": "item-050",
                "description": "Set a sleep and hydration target for the block.",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-014",
                "title": "Average daily protein",
                "description": "Protein intake across the week",
                "order": "increasing",
                "reading": 125,
                "targetValue": 120,
                "minValue": 0,
                "maxValue": 150,
                "unit": "g",
                "dimension": "execution"
              },
              {
                "id": "stat-014-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 4.6,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-014-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 150,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-014-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              },
              {
                "id": "trace-card-014-2",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              },
              {
                "id": "trace-card-014-3",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [],
            "reflection": ""
          },
          {
            "id": "card-015",
            "title": "Week 2",
            "subtitle": "Upper-body strength and posture",
            "targetDate": "2026-05-12",
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
                "id": "item-018",
                "description": "Match bench and row volume",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-034",
                  "mediaType": "image",
                  "description": "Row Technique",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-051",
                "description": "Add shoulder prehab work after each upper-body lift.",
                "completionStatus": "done"
              },
              {
                "id": "item-052",
                "description": "Record posture check photos before and after the week.",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-015",
                "title": "Bench press working weight",
                "description": "Top set of 6 reps",
                "order": "increasing",
                "reading": 67.5,
                "targetValue": 67.5,
                "minValue": 0,
                "maxValue": 81,
                "unit": "kg",
                "dimension": "execution"
              },
              {
                "id": "stat-015-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 4.6,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-015-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 153,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-card-015",
                "comments": [
                  {
                    "id": "comment-card-015-1",
                    "creatorId": "user-002",
                    "createdAt": "2026-05-12T17:30:00Z",
                    "text": "Cleaner under pressure",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "Small progress still counts"
          },
          {
            "id": "card-016",
            "title": "Week 3",
            "subtitle": "Conditioning without losing strength",
            "targetDate": "2026-05-19",
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
                "id": "item-019",
                "description": "Complete 2 short conditioning finishers",
                "completionStatus": "inProgress",
                "mediaItem": {
                  "id": "media-036",
                  "mediaType": "image",
                  "description": "Conditioning finisher board",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-053",
                "description": "Hit all lower-body target loads",
                "completionStatus": "done"
              },
              {
                "id": "item-054",
                "description": "Log body weight and readiness across three mornings.",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-016",
                "title": "Resting body weight",
                "description": "Average morning weight",
                "order": "decreasing",
                "reading": 75.79,
                "targetValue": 75.5,
                "minValue": 72,
                "maxValue": 76.8,
                "unit": "kg",
                "dimension": "execution"
              },
              {
                "id": "stat-016-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 3.6,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-016-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 127,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-016-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [],
            "reflection": "Held focus for longer"
          },
          {
            "id": "card-017",
            "title": "Week 4",
            "subtitle": "Strength retention check",
            "targetDate": "2026-05-26",
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
                "id": "item-020",
                "description": "Retest main lifts at submaximal effort.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-038",
                  "mediaType": "image",
                  "description": "Submax Retest",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-055",
                "description": "Compare Week 1 and Week 4 pull-up quality.",
                "completionStatus": "todo"
              },
              {
                "id": "item-056",
                "description": "Write one maintenance target for the next block.",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-017",
                "title": "Pull-ups at bodyweight",
                "description": "Max clean reps",
                "order": "increasing",
                "reading": 0,
                "targetValue": 10,
                "minValue": 0,
                "maxValue": 12,
                "unit": "reps",
                "dimension": "execution"
              },
              {
                "id": "stat-017-confidence",
                "title": "Movement confidence",
                "description": "How settled the movement pattern felt this week",
                "order": "increasing",
                "reading": 2.6,
                "targetValue": 4.3,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-017-load",
                "title": "Load tolerance",
                "description": "Capacity to absorb the week's training load",
                "order": "increasing",
                "reading": 93,
                "targetValue": 145,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": ""
          }
        ]
      },
      {
        "id": "deck-005",
        "title": "Beating a Full-Back 1v1",
        "category": "football",
        "status": "inProgress",
        "cards": [
          {
            "id": "card-018",
            "title": "Week 1",
            "subtitle": "Change of pace basics",
            "targetDate": "2026-05-01",
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
                "id": "item-021",
                "description": "Complete 30 slow-fast dribble reps each side.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-040",
                  "mediaType": "image",
                  "description": "Slow-fast dribble cone setup",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-057",
                "description": "Film 10 take-ons showing the speed change.",
                "completionStatus": "done"
              },
              {
                "id": "item-058",
                "description": "Use the move twice in a small-sided game.",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-018",
                "signalKey": "oneVOneEffectiveness",
                "title": "Successful take-ons",
                "description": "Successful 1v1s in training game",
                "order": "increasing",
                "reading": 5.2,
                "targetValue": 5,
                "minValue": 0,
                "maxValue": 6,
                "unit": "take-ons",
                "dimension": "execution"
              },
              {
                "id": "stat-018-confidence",
                "signalKey": "confidenceStability",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 4.1,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-018-pressure",
                "signalKey": "pressureTolerance",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 130,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-018-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-018",
                "comments": [
                  {
                    "id": "comment-card-018-1",
                    "creatorId": "user-005",
                    "createdAt": "2026-05-01T17:30:00Z",
                    "text": "Way more settled lately.",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "Felt smoother without forcing it."
          },
          {
            "id": "card-019",
            "title": "Week 2",
            "subtitle": "Body feints and disguise",
            "targetDate": "2026-05-08",
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
                "id": "item-022",
                "description": "Practise 40 body feints into outside acceleration.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-042",
                  "mediaType": "image",
                  "description": "Body Feint Outside Push",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-059",
                "description": "Complete 20 feints into inside carries.",
                "completionStatus": "done"
              },
              {
                "id": "item-060",
                "description": "Clip one defender biting on the feint",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-019",
                "signalKey": "oneVOneEffectiveness",
                "title": "Defender wrong-footed",
                "description": "Times defender shifts weight before touch",
                "order": "increasing",
                "reading": 7,
                "targetValue": 8,
                "minValue": 0,
                "maxValue": 10,
                "unit": "actions",
                "dimension": "execution"
              },
              {
                "id": "stat-019-confidence",
                "signalKey": "confidenceStability",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 3.6,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-019-pressure",
                "signalKey": "pressureTolerance",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 117,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-019-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [],
            "reflection": "Calmer when things got difficult."
          },
          {
            "id": "card-020",
            "title": "Week 3",
            "subtitle": "Attack both sides",
            "targetDate": "2026-05-15",
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
                "id": "item-023",
                "description": "Mix inside cuts and outside bursts",
                "completionStatus": "inProgress",
                "mediaItem": {
                  "id": "media-044",
                  "mediaType": "image",
                  "description": "Winger 1v1 lane setup",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-061",
                "description": "Use three weaker-side attacks in a possession game.",
                "completionStatus": "done"
              },
              {
                "id": "item-062",
                "description": "Review whether the defender over-protects one side.",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-020",
                "signalKey": "oneVOneEffectiveness",
                "title": "Inside/outside balance",
                "description": "Percentage of attacks going weaker side",
                "order": "increasing",
                "reading": 73,
                "targetValue": 45,
                "minValue": 0,
                "maxValue": 100,
                "unit": "%",
                "dimension": "stability"
              },
              {
                "id": "stat-020-confidence",
                "signalKey": "confidenceStability",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 3.7,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-020-pressure",
                "signalKey": "pressureTolerance",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 112,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-020-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-020",
                "comments": [
                  {
                    "id": "comment-card-020-1",
                    "creatorId": "user-005",
                    "createdAt": "2026-05-15T17:30:00Z",
                    "text": "Massive difference from a few weeks ago.",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "Still feels fragile underneath."
          },
          {
            "id": "card-021",
            "title": "Week 4",
            "subtitle": "End product after the take-on",
            "targetDate": "2026-05-22",
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
                "id": "item-024",
                "description": "Complete 25 take-on into cutback reps.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-046",
                  "mediaType": "image",
                  "description": "Cutback Repetition Drill",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-063",
                "description": "Hit five low crosses after beating a passive defender.",
                "completionStatus": "todo"
              },
              {
                "id": "item-064",
                "description": "Film two end-product reps from each side.",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-021",
                "signalKey": "oneVOneEffectiveness",
                "title": "Chance creation after take-on",
                "description": "Shots or dangerous passes after beating defender",
                "order": "increasing",
                "reading": 7.2,
                "targetValue": 6,
                "minValue": 0,
                "maxValue": 8,
                "unit": "actions",
                "dimension": "execution"
              },
              {
                "id": "stat-021-confidence",
                "signalKey": "confidenceStability",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 4.2,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-021-pressure",
                "signalKey": "pressureTolerance",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 126,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-021-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-021",
                "comments": [
                  {
                    "id": "comment-card-021-1",
                    "creatorId": "user-005",
                    "createdAt": "2026-05-22T17:30:00Z",
                    "text": "Much cleaner under pressure.",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "I could feel the timing settling."
          },
          {
            "id": "card-022",
            "title": "Week 5",
            "subtitle": "Match application",
            "targetDate": "2026-05-29",
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
                "id": "item-025",
                "description": "Clip 5 1v1 moments from match or full training game.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-048",
                  "mediaType": "image",
                  "description": "Match Clip Review",
                  "src": "/images/media-traces/gym-trace-01.png"
                }
              },
              {
                "id": "item-065",
                "description": "Tag every 1v1 as inside, outside or recycle.",
                "completionStatus": "todo"
              },
              {
                "id": "item-066",
                "description": "Choose one decision-making target for the next match.",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-022",
                "signalKey": "oneVOneEffectiveness",
                "title": "Effective 1v1 actions",
                "description": "Take-ons leading to advantage",
                "order": "increasing",
                "reading": 4,
                "targetValue": 7,
                "minValue": 0,
                "maxValue": 9,
                "unit": "actions",
                "dimension": "execution"
              },
              {
                "id": "stat-022-confidence",
                "signalKey": "confidenceStability",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 1.9,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-022-pressure",
                "signalKey": "pressureTolerance",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 12,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": "Low energy, but I didn't disappear."
          }
        ]
      },
      {
        "id": "deck-006",
        "title": "10 Week Performance Test",
        "category": "football",
        "status": "inProgress",
        "cards": [
          {
            "id": "card-024",
            "title": "Week 1",
            "subtitle": "Acceleration baseline",
            "targetDate": "2026-06-03",
            "intro": {
              "description": "Establish first-step speed, sprint posture and repeatable acceleration markers.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-067",
                "description": "Record 3 10-metre sprint times",
                "completionStatus": "done"
              },
              {
                "id": "item-068",
                "description": "Film 2 starts from side angle",
                "completionStatus": "done"
              },
              {
                "id": "item-069",
                "description": "Log best time and recovery gaps",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-024",
                "title": "10m sprint",
                "description": "Best acceleration time",
                "order": "decreasing",
                "reading": 5,
                "targetValue": 1.85,
                "minValue": 1.6,
                "maxValue": 5,
                "unit": "s",
                "dimension": "execution"
              },
              {
                "id": "stat-024-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 1,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-024-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 0,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": "Felt flat, but I stayed present."
          },
          {
            "id": "card-025",
            "title": "Week 2",
            "subtitle": "Repeat sprint quality",
            "targetDate": "2026-06-10",
            "intro": {
              "description": "Improve the ability to repeat high-quality sprints with consistent recovery and technique.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-071",
                "description": "Complete repeat 20-metre sprints",
                "completionStatus": "done"
              },
              {
                "id": "item-072",
                "description": "Track drop-off between fastest and slowest sprint.",
                "completionStatus": "done"
              },
              {
                "id": "item-073",
                "description": "Review posture under fatigue",
                "completionStatus": "done"
              }
            ],
            "stats": [
              {
                "id": "stat-025",
                "title": "Sprint drop-off",
                "description": "Difference across repeat sprint set",
                "order": "decreasing",
                "reading": 18.8,
                "targetValue": 4,
                "minValue": 2,
                "maxValue": 30,
                "unit": "%",
                "dimension": "adaptation"
              },
              {
                "id": "stat-025-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 1,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-025-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 0,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": "A small signal started to return."
          },
          {
            "id": "card-026",
            "title": "Week 3",
            "subtitle": "Change of direction entry",
            "targetDate": "2026-06-17",
            "intro": {
              "description": "Build cleaner deceleration shapes before changing direction at speed.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-075",
                "description": "Complete decel entries each side",
                "completionStatus": "done"
              },
              {
                "id": "item-076",
                "description": "Film front-on foot placement",
                "completionStatus": "done"
              },
              {
                "id": "item-077",
                "description": "Add ball-carry exits after decels",
                "completionStatus": "inProgress"
              }
            ],
            "stats": [
              {
                "id": "stat-026",
                "title": "Clean COD entries",
                "description": "Controlled entries out of 20 reps",
                "order": "increasing",
                "reading": 9,
                "targetValue": 16,
                "minValue": 0,
                "maxValue": 20,
                "unit": "reps",
                "dimension": "stability"
              },
              {
                "id": "stat-026-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 2.6,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-026-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 9,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": "Still tentative, but movement continued."
          },
          {
            "id": "card-027",
            "title": "Week 4",
            "subtitle": "Strength support",
            "targetDate": "2026-06-24",
            "intro": {
              "description": "Support on-pitch speed with lower-body strength, trunk control and hamstring robustness.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-079",
                "description": "Complete trap-bar and split squat sets",
                "completionStatus": "done"
              },
              {
                "id": "item-080",
                "description": "Add Copenhagen plank holds after the main lift.",
                "completionStatus": "inProgress"
              },
              {
                "id": "item-081",
                "description": "Complete Nordic hamstring progressions",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-027",
                "title": "Split squat load",
                "description": "Top working set per hand",
                "order": "increasing",
                "reading": 0,
                "targetValue": 28,
                "minValue": 0,
                "maxValue": 34,
                "unit": "kg",
                "dimension": "adaptation"
              },
              {
                "id": "stat-027-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 1,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-027-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 0,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-027-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-027",
                "comments": [
                  {
                    "id": "comment-card-027-1",
                    "creatorId": "user-005",
                    "createdAt": "2026-06-24T17:30:00Z",
                    "text": "You stayed with it.",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "The work felt quiet and heavy."
          },
          {
            "id": "card-028",
            "title": "Week 5",
            "subtitle": "High-speed ball carries",
            "targetDate": "2026-07-01",
            "intro": {
              "description": "Connect sprint mechanics to carrying the ball at pace without losing control.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-083",
                "description": "Complete high-speed ball carries",
                "completionStatus": "inProgress"
              },
              {
                "id": "item-084",
                "description": "Measure touch count during each carry.",
                "completionStatus": "todo"
              },
              {
                "id": "item-085",
                "description": "Film carries from behind",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-028",
                "title": "Controlled carries",
                "description": "Fast carries completed without heavy touch",
                "order": "increasing",
                "reading": 3.2,
                "targetValue": 6,
                "minValue": 0,
                "maxValue": 8,
                "unit": "carries",
                "dimension": "stability"
              },
              {
                "id": "stat-028-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 1,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-028-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 0,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-028-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-028",
                "comments": [
                  {
                    "id": "comment-card-028-1",
                    "creatorId": "user-005",
                    "createdAt": "2026-07-01T17:30:00Z",
                    "text": "Looked calmer this week.",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "One part felt easier to access."
          },
          {
            "id": "card-029",
            "title": "Week 6",
            "subtitle": "Pressing repeatability",
            "targetDate": "2026-07-08",
            "intro": {
              "description": "Test repeated pressing actions and recovery between high-intensity defensive efforts.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-087",
                "description": "Complete 6 pressing waves",
                "completionStatus": "todo"
              },
              {
                "id": "item-088",
                "description": "Track first step and body angle",
                "completionStatus": "todo"
              },
              {
                "id": "item-089",
                "description": "Clip one sharp press and one late press",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-029",
                "title": "Effective presses",
                "description": "Presses that force backward or rushed play",
                "order": "increasing",
                "reading": 4.5,
                "targetValue": 8,
                "minValue": 0,
                "maxValue": 10,
                "unit": "presses",
                "dimension": "execution"
              },
              {
                "id": "stat-029-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 2.6,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-029-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 9,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-029-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-029",
                "comments": [
                  {
                    "id": "comment-card-029-1",
                    "creatorId": "user-005",
                    "createdAt": "2026-07-08T17:30:00Z",
                    "text": "Movement felt more natural.",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "Some rhythm returned, still uneven underneath."
          },
          {
            "id": "card-030",
            "title": "Week 7",
            "subtitle": "Power maintenance",
            "targetDate": "2026-07-15",
            "intro": {
              "description": "Maintain jump and sprint qualities while training volume increases.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-091",
                "description": "Complete 2 low-volume jump sessions",
                "completionStatus": "todo"
              },
              {
                "id": "item-092",
                "description": "Retest standing vertical jump after warm-up.",
                "completionStatus": "todo"
              },
              {
                "id": "item-093",
                "description": "Add sprint exposures after first lift",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-030",
                "title": "Vertical jump",
                "description": "Best weekly jump height",
                "order": "increasing",
                "reading": 34.32,
                "targetValue": 55,
                "minValue": 0,
                "maxValue": 66,
                "unit": "cm",
                "dimension": "execution"
              },
              {
                "id": "stat-030-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 2.92,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-030-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 99,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": "Felt steady without needing much around it."
          },
          {
            "id": "card-031",
            "title": "Week 8",
            "subtitle": "Match-speed decisions",
            "targetDate": "2026-07-22",
            "intro": {
              "description": "Bring physical improvements into match-speed choices with and without the ball.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-095",
                "description": "Play 4v4 with sprint triggers",
                "completionStatus": "todo"
              },
              {
                "id": "item-096",
                "description": "Track decisions after sprint actions",
                "completionStatus": "todo"
              },
              {
                "id": "item-097",
                "description": "Clip one calm and one rushed choice",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-031",
                "title": "Positive transition decisions",
                "description": "Decisions after high-speed actions",
                "order": "increasing",
                "reading": 4.16,
                "targetValue": 6,
                "minValue": 0,
                "maxValue": 8,
                "unit": "decisions",
                "dimension": "reflection"
              },
              {
                "id": "stat-031-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 2.92,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-031-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 99,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-031-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-031",
                "comments": [
                  {
                    "id": "comment-card-031-1",
                    "creatorId": "user-005",
                    "createdAt": "2026-07-22T17:30:00Z",
                    "text": "More settled overall.",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "Support made the same steadiness feel warmer."
          },
          {
            "id": "card-032",
            "title": "Week 9",
            "subtitle": "Retest week",
            "targetDate": "2026-07-29",
            "intro": {
              "description": "Retest sprint, jump and repeat-effort markers with clean recovery and consistent warm-up.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-099",
                "description": "Retest 10-metre sprint",
                "completionStatus": "todo"
              },
              {
                "id": "item-100",
                "description": "Retest vertical jump and compare with Week 1.",
                "completionStatus": "todo"
              },
              {
                "id": "item-101",
                "description": "Complete one repeat sprint retest",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-032",
                "title": "Retest readiness",
                "description": "Completed retest components",
                "order": "increasing",
                "reading": 5,
                "targetValue": 4,
                "minValue": 0,
                "maxValue": 5,
                "unit": "tests",
                "dimension": "recovery"
              },
              {
                "id": "stat-032-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 4.8,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-032-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 171,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [],
            "chats": [],
            "reflection": "The work felt available and composed."
          },
          {
            "id": "card-033",
            "title": "Week 10",
            "subtitle": "Performance review",
            "targetDate": "2026-08-05",
            "intro": {
              "description": "Use the final week to review progress, pick the next focus and preserve the most useful routines.",
              "mediaItem": undefined
            },
            "items": [
              {
                "id": "item-103",
                "description": "Choose 3 improved output clips",
                "completionStatus": "todo"
              },
              {
                "id": "item-104",
                "description": "Compare Week 1 and Week 9 test numbers.",
                "completionStatus": "todo"
              },
              {
                "id": "item-105",
                "description": "Write the next 4-week priority",
                "completionStatus": "todo"
              }
            ],
            "stats": [
              {
                "id": "stat-033",
                "title": "Review actions",
                "description": "Completed review tasks",
                "order": "increasing",
                "reading": 5,
                "targetValue": 4,
                "minValue": 0,
                "maxValue": 5,
                "unit": "actions",
                "dimension": "reflection"
              },
              {
                "id": "stat-033-confidence",
                "title": "Confidence stability",
                "description": "Composure held across this week's technical work",
                "order": "increasing",
                "reading": 4.76,
                "targetValue": 4.4,
                "minValue": 1,
                "maxValue": 5,
                "unit": "",
                "dimension": "stability"
              },
              {
                "id": "stat-033-pressure",
                "title": "Pressure tolerance",
                "description": "Ability to keep shape and choice under pressure",
                "order": "increasing",
                "reading": 176,
                "targetValue": 144,
                "minValue": 0,
                "maxValue": 180,
                "unit": "",
                "dimension": "adaptation"
              }
            ],
            "mediaItems": [
              {
                "id": "trace-card-033-1",
                "mediaType": "image",
                "description": "Retained weekly media trace",
                "src": "/images/media-traces/gym-trace-01.png"
              }
            ],
            "chats": [
              {
                "id": "chat-card-033",
                "comments": [
                  {
                    "id": "comment-card-033-1",
                    "creatorId": "user-005",
                    "createdAt": "2026-08-05T17:30:00Z",
                    "text": "Timing looked cleaner.",
                    "isRetained": true
                  }
                ]
              }
            ],
            "reflection": "Strong signals, still grounded in the work."
          }
        ]
      }
    ]
  }
}
