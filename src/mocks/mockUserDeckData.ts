import type { UserDeckData } from "@/components/decks/types";

export const mockUserDeckData: UserDeckData[] = [
  {
    "deckTemplateId": "deck-001",
    "status": "inProgress",
    "activeCardId": "card-001",
    "cards": [
      {
        "cardId": "card-001",
        "targetDate": "2026-05-03",
        "items": [
          {
            "itemId": "item-001",
            "completionStatus": "done"
          },
          {
            "itemId": "item-002",
            "completionStatus": "done"
          },
          {
            "itemId": "item-107",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-001",
            "reading": 7
          },
          {
            "signalId": "signal-001-confidence",
            "reading": 4.6
          },
          {
            "signalId": "signal-001-load",
            "reading": 150
          }
        ],
        "reflection": "Felt more controlled overall",
        "mediaItems": [],
        "chats": []
      },
      {
        "cardId": "card-002",
        "targetDate": "2026-05-10",
        "items": [
          {
            "itemId": "item-003",
            "completionStatus": "done"
          },
          {
            "itemId": "item-004",
            "completionStatus": "done"
          },
          {
            "itemId": "item-108",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-002",
            "reading": 5
          },
          {
            "signalId": "signal-002-confidence",
            "reading": 4.6
          },
          {
            "signalId": "signal-002-load",
            "reading": 153
          }
        ],
        "reflection": "Still rushing under fatigue",
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
        ]
      },
      {
        "cardId": "card-003",
        "targetDate": "2026-05-17",
        "items": [
          {
            "itemId": "item-005",
            "completionStatus": "inProgress"
          },
          {
            "itemId": "item-006",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-109",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-003",
            "reading": 3
          },
          {
            "signalId": "signal-003-confidence",
            "reading": 2.9
          },
          {
            "signalId": "signal-003-load",
            "reading": 108
          }
        ],
        "reflection": "Closer than last week",
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
        ]
      },
      {
        "cardId": "card-004",
        "targetDate": "2026-05-24",
        "items": [
          {
            "itemId": "item-007",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-026",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-027",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-004",
            "reading": 0
          },
          {
            "signalId": "signal-004-confidence",
            "reading": 2.6
          },
          {
            "signalId": "signal-004-load",
            "reading": 93
          }
        ],
        "reflection": "",
        "mediaItems": [],
        "chats": []
      }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "deckTemplateId": "deck-002",
    "status": "completed",
    "activeCardId": "card-005",
    "cards": [
      {
        "cardId": "card-005",
        "targetDate": "2026-03-22",
        "items": [
          {
            "itemId": "item-008",
            "completionStatus": "done"
          },
          {
            "itemId": "item-028",
            "completionStatus": "done"
          },
          {
            "itemId": "item-029",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-005",
            "reading": 90
          },
          {
            "signalId": "signal-005-confidence",
            "reading": 4.6
          },
          {
            "signalId": "signal-005-load",
            "reading": 150
          }
        ],
        "reflection": "",
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
        "chats": []
      },
      {
        "cardId": "card-006",
        "targetDate": "2026-03-29",
        "items": [
          {
            "itemId": "item-009",
            "completionStatus": "done"
          },
          {
            "itemId": "item-030",
            "completionStatus": "done"
          },
          {
            "itemId": "item-031",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-006",
            "reading": 12
          },
          {
            "signalId": "signal-006-confidence",
            "reading": 1.7
          },
          {
            "signalId": "signal-006-load",
            "reading": 32
          }
        ],
        "reflection": "Transition finally felt calmer",
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
        ]
      },
      {
        "cardId": "card-007",
        "targetDate": "2026-04-05",
        "items": [
          {
            "itemId": "item-010",
            "completionStatus": "done"
          },
          {
            "itemId": "item-032",
            "completionStatus": "done"
          },
          {
            "itemId": "item-033",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-007",
            "reading": 24
          },
          {
            "signalId": "signal-007-confidence",
            "reading": 4.6
          },
          {
            "signalId": "signal-007-load",
            "reading": 156
          }
        ],
        "reflection": "Need to trust first touch earlier",
        "mediaItems": [
          {
            "id": "trace-card-007-1",
            "mediaType": "image",
            "description": "Retained weekly media trace",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        ],
        "chats": []
      },
      {
        "cardId": "card-008",
        "targetDate": "2026-04-12",
        "items": [
          {
            "itemId": "item-011",
            "completionStatus": "done"
          },
          {
            "itemId": "item-034",
            "completionStatus": "done"
          },
          {
            "itemId": "item-035",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-008",
            "reading": 54
          },
          {
            "signalId": "signal-008-confidence",
            "reading": 4.7
          },
          {
            "signalId": "signal-008-load",
            "reading": 150
          }
        ],
        "reflection": "Reset and go again",
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
        ]
      }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "deckTemplateId": "deck-003",
    "status": "inProgress",
    "activeCardId": "card-009",
    "cards": [
      {
        "cardId": "card-009",
        "targetDate": "2026-04-27",
        "items": [
          {
            "itemId": "item-012",
            "completionStatus": "done"
          },
          {
            "itemId": "item-036",
            "completionStatus": "done"
          },
          {
            "itemId": "item-037",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-009",
            "reading": 40
          },
          {
            "signalId": "signal-009-confidence",
            "reading": 4.6
          },
          {
            "signalId": "signal-009-pressure",
            "reading": 148
          }
        ],
        "reflection": "",
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
        ]
      },
      {
        "cardId": "card-010",
        "targetDate": "2026-05-04",
        "items": [
          {
            "itemId": "item-013",
            "completionStatus": "done"
          },
          {
            "itemId": "item-038",
            "completionStatus": "done"
          },
          {
            "itemId": "item-039",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-010",
            "reading": 1.4
          },
          {
            "signalId": "signal-010-confidence",
            "reading": 4.6
          },
          {
            "signalId": "signal-010-pressure",
            "reading": 151
          }
        ],
        "reflection": "Rhythm came back late",
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
        ]
      },
      {
        "cardId": "card-011",
        "targetDate": "2026-05-11",
        "items": [
          {
            "itemId": "item-014",
            "completionStatus": "done"
          },
          {
            "itemId": "item-040",
            "completionStatus": "done"
          },
          {
            "itemId": "item-041",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-011",
            "reading": 29
          },
          {
            "signalId": "signal-011-confidence",
            "reading": 4.7
          },
          {
            "signalId": "signal-011-pressure",
            "reading": 154
          }
        ],
        "reflection": "More composed overall",
        "mediaItems": [
          {
            "id": "trace-card-011-1",
            "mediaType": "image",
            "description": "Retained weekly media trace",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        ],
        "chats": []
      },
      {
        "cardId": "card-012",
        "targetDate": "2026-05-18",
        "items": [
          {
            "itemId": "item-015",
            "completionStatus": "inProgress"
          },
          {
            "itemId": "item-042",
            "completionStatus": "done"
          },
          {
            "itemId": "item-043",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-012",
            "reading": 6
          },
          {
            "signalId": "signal-012-confidence",
            "reading": 3.7
          },
          {
            "signalId": "signal-012-pressure",
            "reading": 118
          }
        ],
        "reflection": "Kept shape better today",
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
        ]
      },
      {
        "cardId": "card-013",
        "targetDate": "2026-05-25",
        "items": [
          {
            "itemId": "item-016",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-044",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-045",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-013",
            "reading": 0
          },
          {
            "signalId": "signal-013-confidence",
            "reading": 2.7
          },
          {
            "signalId": "signal-013-pressure",
            "reading": 91
          }
        ],
        "reflection": "",
        "mediaItems": [],
        "chats": []
      },
      {
        "cardId": "card-023",
        "targetDate": "2026-06-01",
        "items": [
          {
            "itemId": "item-046",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-047",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-048",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-023",
            "reading": 0
          },
          {
            "signalId": "signal-023-confidence",
            "reading": 2.7
          },
          {
            "signalId": "signal-023-pressure",
            "reading": 94
          }
        ],
        "reflection": "",
        "mediaItems": [],
        "chats": []
      }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "deckTemplateId": "deck-004",
    "status": "inProgress",
    "activeCardId": "card-014",
    "cards": [
      {
        "cardId": "card-014",
        "targetDate": "2026-05-05",
        "items": [
          {
            "itemId": "item-017",
            "completionStatus": "done"
          },
          {
            "itemId": "item-049",
            "completionStatus": "done"
          },
          {
            "itemId": "item-050",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-014",
            "reading": 125
          },
          {
            "signalId": "signal-014-confidence",
            "reading": 4.6
          },
          {
            "signalId": "signal-014-load",
            "reading": 150
          }
        ],
        "reflection": "",
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
        "chats": []
      },
      {
        "cardId": "card-015",
        "targetDate": "2026-05-12",
        "items": [
          {
            "itemId": "item-018",
            "completionStatus": "done"
          },
          {
            "itemId": "item-051",
            "completionStatus": "done"
          },
          {
            "itemId": "item-052",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-015",
            "reading": 67.5
          },
          {
            "signalId": "signal-015-confidence",
            "reading": 4.6
          },
          {
            "signalId": "signal-015-load",
            "reading": 153
          }
        ],
        "reflection": "Small progress still counts",
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
        ]
      },
      {
        "cardId": "card-016",
        "targetDate": "2026-05-19",
        "items": [
          {
            "itemId": "item-019",
            "completionStatus": "inProgress"
          },
          {
            "itemId": "item-053",
            "completionStatus": "done"
          },
          {
            "itemId": "item-054",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-016",
            "reading": 75.79
          },
          {
            "signalId": "signal-016-confidence",
            "reading": 3.6
          },
          {
            "signalId": "signal-016-load",
            "reading": 127
          }
        ],
        "reflection": "Held focus for longer",
        "mediaItems": [
          {
            "id": "trace-card-016-1",
            "mediaType": "image",
            "description": "Retained weekly media trace",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        ],
        "chats": []
      },
      {
        "cardId": "card-017",
        "targetDate": "2026-05-26",
        "items": [
          {
            "itemId": "item-020",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-055",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-056",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-017",
            "reading": 0
          },
          {
            "signalId": "signal-017-confidence",
            "reading": 2.6
          },
          {
            "signalId": "signal-017-load",
            "reading": 93
          }
        ],
        "reflection": "",
        "mediaItems": [],
        "chats": []
      }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "deckTemplateId": "deck-005",
    "status": "inProgress",
    "activeCardId": "card-018",
    "cards": [
      {
        "cardId": "card-018",
        "targetDate": "2026-05-01",
        "items": [
          {
            "itemId": "item-021",
            "completionStatus": "done"
          },
          {
            "itemId": "item-057",
            "completionStatus": "done"
          },
          {
            "itemId": "item-058",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-018",
            "reading": 5.2
          },
          {
            "signalId": "signal-018-confidence",
            "reading": 4.1
          },
          {
            "signalId": "signal-018-pressure",
            "reading": 130
          }
        ],
        "reflection": "Felt smoother without forcing it.",
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
        ]
      },
      {
        "cardId": "card-019",
        "targetDate": "2026-05-08",
        "items": [
          {
            "itemId": "item-022",
            "completionStatus": "done"
          },
          {
            "itemId": "item-059",
            "completionStatus": "done"
          },
          {
            "itemId": "item-060",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-019",
            "reading": 7
          },
          {
            "signalId": "signal-019-confidence",
            "reading": 3.6
          },
          {
            "signalId": "signal-019-pressure",
            "reading": 117
          }
        ],
        "reflection": "Calmer when things got difficult.",
        "mediaItems": [
          {
            "id": "trace-card-019-1",
            "mediaType": "image",
            "description": "Retained weekly media trace",
            "src": "/images/media-traces/gym-trace-01.png"
          }
        ],
        "chats": []
      },
      {
        "cardId": "card-020",
        "targetDate": "2026-05-15",
        "items": [
          {
            "itemId": "item-023",
            "completionStatus": "inProgress"
          },
          {
            "itemId": "item-061",
            "completionStatus": "done"
          },
          {
            "itemId": "item-062",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-020",
            "reading": 73
          },
          {
            "signalId": "signal-020-confidence",
            "reading": 3.7
          },
          {
            "signalId": "signal-020-pressure",
            "reading": 112
          }
        ],
        "reflection": "Still feels fragile underneath.",
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
        ]
      },
      {
        "cardId": "card-021",
        "targetDate": "2026-05-22",
        "items": [
          {
            "itemId": "item-024",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-063",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-064",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-021",
            "reading": 7.2
          },
          {
            "signalId": "signal-021-confidence",
            "reading": 4.2
          },
          {
            "signalId": "signal-021-pressure",
            "reading": 126
          }
        ],
        "reflection": "I could feel the timing settling.",
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
        ]
      },
      {
        "cardId": "card-022",
        "targetDate": "2026-05-29",
        "items": [
          {
            "itemId": "item-025",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-065",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-066",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-022",
            "reading": 4
          },
          {
            "signalId": "signal-022-confidence",
            "reading": 1.9
          },
          {
            "signalId": "signal-022-pressure",
            "reading": 12
          }
        ],
        "reflection": "Low energy, but I didn't disappear.",
        "mediaItems": [],
        "chats": []
      }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "deckTemplateId": "deck-006",
    "status": "inProgress",
    "activeCardId": "card-024",
    "cards": [
      {
        "cardId": "card-024",
        "targetDate": "2026-06-03",
        "items": [
          {
            "itemId": "item-067",
            "completionStatus": "done"
          },
          {
            "itemId": "item-068",
            "completionStatus": "done"
          },
          {
            "itemId": "item-069",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-024",
            "reading": 5
          },
          {
            "signalId": "signal-024-confidence",
            "reading": 1
          },
          {
            "signalId": "signal-024-pressure",
            "reading": 0
          }
        ],
        "reflection": "Felt flat, but I stayed present.",
        "mediaItems": [],
        "chats": []
      },
      {
        "cardId": "card-025",
        "targetDate": "2026-06-10",
        "items": [
          {
            "itemId": "item-071",
            "completionStatus": "done"
          },
          {
            "itemId": "item-072",
            "completionStatus": "done"
          },
          {
            "itemId": "item-073",
            "completionStatus": "done"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-025",
            "reading": 18.8
          },
          {
            "signalId": "signal-025-confidence",
            "reading": 1
          },
          {
            "signalId": "signal-025-pressure",
            "reading": 0
          }
        ],
        "reflection": "A small signal started to return.",
        "mediaItems": [],
        "chats": []
      },
      {
        "cardId": "card-026",
        "targetDate": "2026-06-17",
        "items": [
          {
            "itemId": "item-075",
            "completionStatus": "done"
          },
          {
            "itemId": "item-076",
            "completionStatus": "done"
          },
          {
            "itemId": "item-077",
            "completionStatus": "inProgress"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-026",
            "reading": 9
          },
          {
            "signalId": "signal-026-confidence",
            "reading": 2.6
          },
          {
            "signalId": "signal-026-pressure",
            "reading": 9
          }
        ],
        "reflection": "Still tentative, but movement continued.",
        "mediaItems": [],
        "chats": []
      },
      {
        "cardId": "card-027",
        "targetDate": "2026-06-24",
        "items": [
          {
            "itemId": "item-079",
            "completionStatus": "done"
          },
          {
            "itemId": "item-080",
            "completionStatus": "inProgress"
          },
          {
            "itemId": "item-081",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-027",
            "reading": 0
          },
          {
            "signalId": "signal-027-confidence",
            "reading": 1
          },
          {
            "signalId": "signal-027-pressure",
            "reading": 0
          }
        ],
        "reflection": "The work felt quiet and heavy.",
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
        ]
      },
      {
        "cardId": "card-028",
        "targetDate": "2026-07-01",
        "items": [
          {
            "itemId": "item-083",
            "completionStatus": "inProgress"
          },
          {
            "itemId": "item-084",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-085",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-028",
            "reading": 3.2
          },
          {
            "signalId": "signal-028-confidence",
            "reading": 1
          },
          {
            "signalId": "signal-028-pressure",
            "reading": 0
          }
        ],
        "reflection": "One part felt easier to access.",
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
        ]
      },
      {
        "cardId": "card-029",
        "targetDate": "2026-07-08",
        "items": [
          {
            "itemId": "item-087",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-088",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-089",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-029",
            "reading": 4.5
          },
          {
            "signalId": "signal-029-confidence",
            "reading": 2.6
          },
          {
            "signalId": "signal-029-pressure",
            "reading": 9
          }
        ],
        "reflection": "Some rhythm returned, still uneven underneath.",
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
        ]
      },
      {
        "cardId": "card-030",
        "targetDate": "2026-07-15",
        "items": [
          {
            "itemId": "item-091",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-092",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-093",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-030",
            "reading": 34.32
          },
          {
            "signalId": "signal-030-confidence",
            "reading": 2.92
          },
          {
            "signalId": "signal-030-pressure",
            "reading": 99
          }
        ],
        "reflection": "Felt steady without needing much around it.",
        "mediaItems": [],
        "chats": []
      },
      {
        "cardId": "card-031",
        "targetDate": "2026-07-22",
        "items": [
          {
            "itemId": "item-095",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-096",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-097",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-031",
            "reading": 4.16
          },
          {
            "signalId": "signal-031-confidence",
            "reading": 2.92
          },
          {
            "signalId": "signal-031-pressure",
            "reading": 99
          }
        ],
        "reflection": "Support made the same steadiness feel warmer.",
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
        ]
      },
      {
        "cardId": "card-032",
        "targetDate": "2026-07-29",
        "items": [
          {
            "itemId": "item-099",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-100",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-101",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-032",
            "reading": 5
          },
          {
            "signalId": "signal-032-confidence",
            "reading": 4.8
          },
          {
            "signalId": "signal-032-pressure",
            "reading": 171
          }
        ],
        "reflection": "The work felt available and composed.",
        "mediaItems": [],
        "chats": []
      },
      {
        "cardId": "card-033",
        "targetDate": "2026-08-05",
        "items": [
          {
            "itemId": "item-103",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-104",
            "completionStatus": "todo"
          },
          {
            "itemId": "item-105",
            "completionStatus": "todo"
          }
        ],
        "signalReadings": [
          {
            "signalId": "signal-033",
            "reading": 5
          },
          {
            "signalId": "signal-033-confidence",
            "reading": 4.76
          },
          {
            "signalId": "signal-033-pressure",
            "reading": 176
          }
        ],
        "reflection": "Strong signals, still grounded in the work.",
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
        ]
      }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
];
