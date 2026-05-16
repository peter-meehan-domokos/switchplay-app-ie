export const switchplayMockData ={
  "connections": [
    { "id": "user-002", "name": "Leo Murphy" },
    { "id": "user-003", "name": "Adam Walsh" },
    { "id": "user-004", "name": "Mason Kelly" },
    { "id": "user-005", "name": "Ryan Byrne" },
    { "id": "user-006", "name": "Noah Collins" }
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
                "mediaType": "video",
                "url": "s3://switchplay-media/calisthenics/week-1-pullup-basics.mp4",
                "title": "Strict Pull-Up Basics",
                "durationSeconds": 420
              }
            },
            "items": [
              {
                "id": "item-001",
                "description": "Complete 4 sets of strict pull-ups, stopping 1 rep before failure.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-002",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/calisthenics/pullup-form.jpg",
                  "alt": "Strict pull-up form"
                }
              },
              {
                "id": "item-002",
                "description": "Practise hollow-body holds for 3 sets of 30 seconds.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-003",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/calisthenics/hollow-hold.mp4",
                  "title": "Hollow Body Position"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-001",
                "title": "Strict pull-ups",
                "description": "Maximum clean reps in one set",
                "order": "increasing",
                "startValue": 5,
                "endValue": 7,
                "targetValue": 7,
                "unit": "reps"
              }
            ],
            "mediaItems": [
              {
                "id": "media-004",
                "mediaType": "embeddedVideo",
                "provider": "youtube",
                "url": "https://www.youtube.com/embed/example-pullup-technique",
                "title": "Pull-Up Technique Breakdown"
              }
            ],
            "chats": [
              {
                "id": "chat-001",
                "comments": [
                  {
                    "id": "comment-001",
                    "creatorId": "user-003",
                    "createdAt": "2026-05-03T18:30:00Z",
                    "text": "Big improvement already. Your reps looked much cleaner this week."
                  }
                ]
              }
            ]
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
                "mediaType": "video",
                "url": "s3://switchplay-media/calisthenics/high-pullups.mp4",
                "title": "High Pull-Up Progressions"
              }
            },
            "items": [
              {
                "id": "item-003",
                "description": "Complete 5 sets of chest-height pull-ups.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-006",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/calisthenics/chest-to-bar.mp4",
                  "title": "Chest-to-Bar Pull-Up"
                }
              },
              {
                "id": "item-004",
                "description": "Practise band-assisted transition drills for 10 minutes.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-007",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/calisthenics/band-transition.jpg",
                  "alt": "Band-assisted muscle-up transition"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-002",
                "title": "Chest-height pull-ups",
                "description": "Best set of explosive reps",
                "order": "increasing",
                "startValue": 2,
                "endValue": 5,
                "targetValue": 5,
                "unit": "reps"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-002",
                "comments": [
                  {
                    "id": "comment-002",
                    "creatorId": "user-002",
                    "createdAt": "2026-05-10T19:10:00Z",
                    "text": "That explosive pull is getting there. You’re close."
                  }
                ]
              }
            ]
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
                "mediaType": "video",
                "url": "s3://switchplay-media/calisthenics/muscle-up-transition.mp4",
                "title": "Muscle-Up Transition"
              }
            },
            "items": [
              {
                "id": "item-005",
                "description": "Complete 4 sets of low-bar transition drills.",
                "completionStatus": "inProgress",
                "mediaItem": {
                  "id": "media-009",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/calisthenics/low-bar-transition.mp4",
                  "title": "Low-Bar Transition Drill"
                }
              },
              {
                "id": "item-006",
                "description": "Film 3 attempts and review elbow path.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-010",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/calisthenics/elbow-path.jpg",
                  "alt": "Muscle-up elbow path reference"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-003",
                "title": "Band-assisted muscle-ups",
                "description": "Clean assisted reps",
                "order": "increasing",
                "startValue": 1,
                "endValue": 3,
                "targetValue": 5,
                "unit": "reps"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-003",
                "comments": [
                  {
                    "id": "comment-003",
                    "creatorId": "user-004",
                    "createdAt": "2026-05-15T20:00:00Z",
                    "text": "Transition is the hard bit. Keep filming it — you’ll spot the timing."
                  }
                ]
              }
            ]
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
                "mediaType": "embeddedVideo",
                "provider": "youtube",
                "url": "https://www.youtube.com/embed/example-muscleup",
                "title": "Clean Bar Muscle-Up Example"
              }
            },
            "items": [
              {
                "id": "item-007",
                "description": "Attempt 6 high-quality muscle-up singles with full rest.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-012",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/calisthenics/muscle-up-single.mp4",
                  "title": "Single Attempt Checklist"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-004",
                "title": "Clean muscle-up attempts",
                "description": "Successful clean reps",
                "order": "increasing",
                "startValue": 0,
                "endValue": 0,
                "targetValue": 1,
                "unit": "reps"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "video",
                "url": "s3://switchplay-media/gym/squat-baseline.mp4",
                "title": "Squat Baseline Session"
              }
            },
            "items": [
              {
                "id": "item-008",
                "description": "Test 5-rep back squat at controlled depth.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-014",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/gym/squat-depth.jpg",
                  "alt": "Back squat depth reference"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-005",
                "title": "Back squat 5RM",
                "description": "Best controlled 5-rep set",
                "order": "increasing",
                "startValue": 85,
                "endValue": 90,
                "targetValue": 90,
                "unit": "kg"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "video",
                "url": "s3://switchplay-media/gym/trap-bar-jumps.mp4",
                "title": "Trap Bar Jump Technique"
              }
            },
            "items": [
              {
                "id": "item-009",
                "description": "Complete 5 sets of 3 trap-bar jumps.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-016",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/gym/explosive-jump.mp4",
                  "title": "Explosive Jump Cue"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-006",
                "title": "Standing vertical jump",
                "description": "Best jump height",
                "order": "increasing",
                "startValue": 48,
                "endValue": 51,
                "targetValue": 51,
                "unit": "cm"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-004",
                "comments": [
                  {
                    "id": "comment-004",
                    "creatorId": "user-006",
                    "createdAt": "2026-03-29T17:50:00Z",
                    "text": "Those jumps looked way sharper than last month."
                  }
                ]
              }
            ]
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
                "mediaType": "img",
                "url": "s3://switchplay-media/gym/bulgarian-split-squat.jpg",
                "alt": "Bulgarian split squat setup"
              }
            },
            "items": [
              {
                "id": "item-010",
                "description": "Complete Bulgarian split squats for 4 sets of 8 each leg.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-018",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/gym/split-squat.mp4",
                  "title": "Split Squat Form"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-007",
                "title": "Split squat load",
                "description": "Dumbbell load per hand for working sets",
                "order": "increasing",
                "startValue": 20,
                "endValue": 24,
                "targetValue": 24,
                "unit": "kg"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "video",
                "url": "s3://switchplay-media/gym/power-retest.mp4",
                "title": "Lower Body Power Retest"
              }
            },
            "items": [
              {
                "id": "item-011",
                "description": "Retest standing vertical jump after warm-up.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-020",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/gym/vertical-jump-test.jpg",
                  "alt": "Vertical jump measurement"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-008",
                "title": "Standing vertical jump",
                "description": "Best retest jump height",
                "order": "increasing",
                "startValue": 48,
                "endValue": 54,
                "targetValue": 53,
                "unit": "cm"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-005",
                "comments": [
                  {
                    "id": "comment-005",
                    "creatorId": "user-002",
                    "createdAt": "2026-04-12T18:25:00Z",
                    "text": "54cm is class. You can see it in your first step now."
                  }
                ]
              }
            ]
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
                "mediaType": "video",
                "url": "s3://switchplay-media/football/receiving-body-shape.mp4",
                "title": "Receiving Body Shape"
              }
            },
            "items": [
              {
                "id": "item-012",
                "description": "Complete 100 wall passes using two-touch control.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-022",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/football/wall-pass-two-touch.mp4",
                  "title": "Two-Touch Wall Passing"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-009",
                "title": "Clean first touches",
                "description": "Clean touches out of 50 attempts",
                "order": "increasing",
                "startValue": 32,
                "endValue": 40,
                "targetValue": 40,
                "unit": "touches"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "embeddedVideo",
                "provider": "youtube",
                "url": "https://www.youtube.com/embed/example-scanning-midfielder",
                "title": "Scanning Before Receiving"
              }
            },
            "items": [
              {
                "id": "item-013",
                "description": "Complete 3 scanning rondo clips and review head checks.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-024",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/football/rondo-scanning.mp4",
                  "title": "Rondo Scanning Drill"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-010",
                "title": "Pre-receive scans",
                "description": "Average scans before receiving in drill",
                "order": "increasing",
                "startValue": 0.8,
                "endValue": 1.4,
                "targetValue": 1.3,
                "unit": "scans"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-006",
                "comments": [
                  {
                    "id": "comment-006",
                    "creatorId": "user-005",
                    "createdAt": "2026-05-04T20:15:00Z",
                    "text": "You looked much calmer receiving in the middle today."
                  }
                ]
              }
            ]
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
                "mediaType": "video",
                "url": "s3://switchplay-media/football/half-turn-receiving.mp4",
                "title": "Receiving on the Half-Turn"
              }
            },
            "items": [
              {
                "id": "item-014",
                "description": "Complete 60 half-turn receives from both sides.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-026",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/football/half-turn-body-shape.jpg",
                  "alt": "Half-turn receiving body shape"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-011",
                "title": "Forward exits",
                "description": "Successful forward first touches out of 40",
                "order": "increasing",
                "startValue": 18,
                "endValue": 29,
                "targetValue": 30,
                "unit": "touches"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "video",
                "url": "s3://switchplay-media/football/pressure-touch-release.mp4",
                "title": "Pressure Touch and Release"
              }
            },
            "items": [
              {
                "id": "item-015",
                "description": "Complete 5 rounds of pressure receiving with a teammate.",
                "completionStatus": "inProgress",
                "mediaItem": {
                  "id": "media-028",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/football/pressure-receive.mp4",
                  "title": "Pressure Receiving Drill"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-012",
                "title": "Turnovers under pressure",
                "description": "Lost possessions in pressure drill",
                "order": "decreasing",
                "startValue": 9,
                "endValue": 6,
                "targetValue": 4,
                "unit": "turnovers"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-007",
                "comments": [
                  {
                    "id": "comment-007",
                    "creatorId": "user-004",
                    "createdAt": "2026-05-15T21:05:00Z",
                    "text": "That last round was quality. You started using your body better."
                  }
                ]
              }
            ]
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
                "mediaType": "img",
                "url": "s3://switchplay-media/football/match-analysis-template.jpg",
                "alt": "Match first-touch review template"
              }
            },
            "items": [
              {
                "id": "item-016",
                "description": "Clip 5 match moments where your first touch created space.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-030",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/football/clip-review-guide.mp4",
                  "title": "Clip Review Guide"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-013",
                "title": "Positive first touches",
                "description": "First touches that improve the next action",
                "order": "increasing",
                "startValue": 11,
                "endValue": 0,
                "targetValue": 18,
                "unit": "actions"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "img",
                "url": "s3://switchplay-media/gym/lean-strength-plan.jpg",
                "alt": "Lean strength training overview"
              }
            },
            "items": [
              {
                "id": "item-017",
                "description": "Track protein intake for 7 days.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-032",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/nutrition/protein-tracker.jpg",
                  "alt": "Protein tracking template"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-014",
                "title": "Average daily protein",
                "description": "Protein intake across the week",
                "order": "increasing",
                "startValue": 95,
                "endValue": 125,
                "targetValue": 120,
                "unit": "g"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "video",
                "url": "s3://switchplay-media/gym/upper-strength-week.mp4",
                "title": "Upper Strength Week"
              }
            },
            "items": [
              {
                "id": "item-018",
                "description": "Complete bench press and row sessions with matched volume.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-034",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/gym/row-technique.mp4",
                  "title": "Row Technique"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-015",
                "title": "Bench press working weight",
                "description": "Top set of 6 reps",
                "order": "increasing",
                "startValue": 62.5,
                "endValue": 67.5,
                "targetValue": 67.5,
                "unit": "kg"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-008",
                "comments": [
                  {
                    "id": "comment-008",
                    "creatorId": "user-006",
                    "createdAt": "2026-05-12T19:40:00Z",
                    "text": "Bench moving well. Don’t chase weight too fast though."
                  }
                ]
              }
            ]
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
                "mediaType": "video",
                "url": "s3://switchplay-media/gym/conditioning-finishers.mp4",
                "title": "Conditioning Finishers"
              }
            },
            "items": [
              {
                "id": "item-019",
                "description": "Complete two 12-minute conditioning finishers after lifting.",
                "completionStatus": "inProgress",
                "mediaItem": {
                  "id": "media-036",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/gym/finisher-board.jpg",
                  "alt": "Conditioning finisher board"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-016",
                "title": "Resting body weight",
                "description": "Average morning weight",
                "order": "decreasing",
                "startValue": 76.4,
                "endValue": 75.8,
                "targetValue": 75.5,
                "unit": "kg"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "img",
                "url": "s3://switchplay-media/gym/strength-retention.jpg",
                "alt": "Strength retention checklist"
              }
            },
            "items": [
              {
                "id": "item-020",
                "description": "Retest main lifts at submaximal effort.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-038",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/gym/submax-retest.mp4",
                  "title": "Submax Retest"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-017",
                "title": "Pull-ups at bodyweight",
                "description": "Max clean reps",
                "order": "increasing",
                "startValue": 8,
                "endValue": 0,
                "targetValue": 10,
                "unit": "reps"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "video",
                "url": "s3://switchplay-media/football/change-of-pace.mp4",
                "title": "Change of Pace 1v1"
              }
            },
            "items": [
              {
                "id": "item-021",
                "description": "Complete 30 slow-fast dribble reps each side.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-040",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/football/slow-fast-dribble.jpg",
                  "alt": "Slow-fast dribble cone setup"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-018",
                "title": "Successful take-ons",
                "description": "Successful 1v1s in training game",
                "order": "increasing",
                "startValue": 3,
                "endValue": 5,
                "targetValue": 5,
                "unit": "take-ons"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "embeddedVideo",
                "provider": "youtube",
                "url": "https://www.youtube.com/embed/example-body-feints",
                "title": "Body Feints for Wide Players"
              }
            },
            "items": [
              {
                "id": "item-022",
                "description": "Practise 40 body feints into outside acceleration.",
                "completionStatus": "done",
                "mediaItem": {
                  "id": "media-042",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/football/body-feint-outside.mp4",
                  "title": "Body Feint Outside Push"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-019",
                "title": "Defender wrong-footed",
                "description": "Times defender shifts weight before touch",
                "order": "increasing",
                "startValue": 4,
                "endValue": 8,
                "targetValue": 8,
                "unit": "actions"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-009",
                "comments": [
                  {
                    "id": "comment-009",
                    "creatorId": "user-002",
                    "createdAt": "2026-05-08T21:00:00Z",
                    "text": "That feint before the assist was exactly what this card was about."
                  }
                ]
              }
            ]
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
                "mediaType": "video",
                "url": "s3://switchplay-media/football/inside-outside-threat.mp4",
                "title": "Inside and Outside Threat"
              }
            },
            "items": [
              {
                "id": "item-023",
                "description": "Complete 20 inside cuts and 20 outside bursts under passive pressure.",
                "completionStatus": "inProgress",
                "mediaItem": {
                  "id": "media-044",
                  "mediaType": "img",
                  "url": "s3://switchplay-media/football/winger-lane-setup.jpg",
                  "alt": "Winger 1v1 lane setup"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-020",
                "title": "Inside/outside balance",
                "description": "Percentage of attacks going weaker side",
                "order": "increasing",
                "startValue": 22,
                "endValue": 35,
                "targetValue": 45,
                "unit": "%"
              }
            ],
            "mediaItems": [],
            "chats": [
              {
                "id": "chat-010",
                "comments": [
                  {
                    "id": "comment-010",
                    "creatorId": "user-005",
                    "createdAt": "2026-05-15T18:45:00Z",
                    "text": "You’re harder to read now because you’re not always cutting inside."
                  }
                ]
              }
            ]
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
                "mediaType": "video",
                "url": "s3://switchplay-media/football/end-product-winger.mp4",
                "title": "End Product After 1v1"
              }
            },
            "items": [
              {
                "id": "item-024",
                "description": "Complete 25 take-on into cutback reps.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-046",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/football/cutback-reps.mp4",
                  "title": "Cutback Repetition Drill"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-021",
                "title": "Chance creation after take-on",
                "description": "Shots or dangerous passes after beating defender",
                "order": "increasing",
                "startValue": 2,
                "endValue": 0,
                "targetValue": 6,
                "unit": "actions"
              }
            ],
            "mediaItems": [],
            "chats": []
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
                "mediaType": "img",
                "url": "s3://switchplay-media/football/1v1-review-sheet.jpg",
                "alt": "1v1 match review sheet"
              }
            },
            "items": [
              {
                "id": "item-025",
                "description": "Clip 5 1v1 moments from match or full training game.",
                "completionStatus": "todo",
                "mediaItem": {
                  "id": "media-048",
                  "mediaType": "video",
                  "url": "s3://switchplay-media/football/match-clip-review.mp4",
                  "title": "Match Clip Review"
                }
              }
            ],
            "stats": [
              {
                "id": "stat-022",
                "title": "Effective 1v1 actions",
                "description": "Take-ons leading to advantage",
                "order": "increasing",
                "startValue": 4,
                "endValue": 0,
                "targetValue": 7,
                "unit": "actions"
              }
            ],
            "mediaItems": [],
            "chats": []
          }
        ]
      }
    ]
  }
}