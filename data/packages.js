const permissions = require("./permissions.json");

const packages = [
    {
        "popular": false,
        "name": "Silver",
        "class": "basic",
        "color": "#00f9ea",
        "price": {
            "month": 8,
            "year": 85
        },
        "permissions": [
            permissions.MOBILE_APP,
            permissions.PAGE.DASHBOARD,
            permissions.FEATURES.ACCOUNT_BALANCE,
            permissions.FEATURES.NET_PNL,
            permissions.FEATURES.AVG_WIN_LOSS,
            permissions.FEATURES.DRAW_DOWN,
            permissions.FEATURES.NET_CUMULATIVE,
            permissions.FEATURES.DAILY_PNL,
            permissions.FEATURES.PROFIT_FACTOR,
            permissions.FEATURES.WINNING_DAYS,
            permissions.FEATURES.TRADE_JOURNAL,
            permissions.FEATURES.TRADES_MANUAL,
            permissions.PAGE.TRADE_IMPORT,
            permissions.FEATURES.SETUPS_TRACKING,
            permissions.FEATURES.MISTAKES_TRACKING,
            permissions.FEATURES.CUSTOMER_BEHAVIOUR,
            permissions.FEATURES.EMAIL_SUPPORT,
            permissions.FEATURES.CHAT_SUPPORT,
            permissions.FEATURES.TRADE_CHARTING,
            permissions.FEATURES.CALENDAR_VIEW,
            permissions.FEATURES.ECONOMIC_CALENDAR,
            permissions.PAGE.REPORTS.OVERVIEW,
            permissions.PAGE.REPORTS.DAYS,
            permissions.PAGE.REPORTS.MONTHS,
            permissions.PAGE.REPORTS.SETUPS,
            permissions.PAGE.REPORTS.WIN_LOSS,
            permissions.PAGE.REPORTS.RISK_REWARD,
            permissions.PAGE.DAILY_JOURNAL,
            permissions.PAGE.PLAYBOOK,
            permissions.PAGE.NOTEBOOK,
            permissions.FEATURES.AI_ASSISTANT,
            permissions.FEATURES.PRIVATE_ACCOUNT_POSSIBILITY,
            permissions.FEATURES.USER_GUIDES,
            permissions.FEATURES.MAX_ACCOUNTS_2
        ],
        "localizedContent": {
            "en": {
                "name": "Silver",
                "description": "Best suited for beginners.",
                "features": [
                    "Up to 2 Accounts",
                    "Daily Reports",
                    "Trading Journal"
                ],
            },
            "de": {
                "name": "Silber",
                "description": "Für Anfänger am besten geeignet",
                "features": [
                    "Bis zu 2 Konten",
                    "Tägliche Berichte",
                    "Handelsjournal"
                ],
            }
        }
    },
    {
        "popular": false,
        "name": "Gold",
        "class": "gold",
        "color": "#ffa800",
        "price": {
            "month": 10,
            "year": 104.49
        },
        "permissions": [
            permissions.MOBILE_APP,
            permissions.PAGE.DASHBOARD,
            permissions.FEATURES.ACCOUNT_BALANCE,
            permissions.FEATURES.NET_PNL,
            permissions.FEATURES.AVG_WIN_LOSS,
            permissions.FEATURES.DRAW_DOWN,
            permissions.FEATURES.NET_CUMULATIVE,
            permissions.FEATURES.DAILY_PNL,
            permissions.FEATURES.PROFIT_FACTOR,
            permissions.FEATURES.WINNING_DAYS,
            permissions.FEATURES.TRADE_JOURNAL,
            permissions.FEATURES.TRADES_MANUAL,
            permissions.PAGE.TRADE_IMPORT,
            permissions.FEATURES.SETUPS_TRACKING,
            permissions.FEATURES.MISTAKES_TRACKING,
            permissions.FEATURES.CUSTOMER_BEHAVIOUR,
            permissions.FEATURES.EMAIL_SUPPORT,
            permissions.FEATURES.CHAT_SUPPORT,
            permissions.FEATURES.TRADE_CHARTING,
            permissions.FEATURES.CALENDAR_VIEW,
            permissions.FEATURES.ECONOMIC_CALENDAR,
            permissions.PAGE.REPORTS.OVERVIEW,
            permissions.PAGE.REPORTS.DAYS,
            permissions.PAGE.REPORTS.MONTHS,
            permissions.PAGE.REPORTS.SETUPS,
            permissions.PAGE.REPORTS.WIN_LOSS,
            permissions.PAGE.REPORTS.RISK_REWARD,
            permissions.PAGE.DAILY_JOURNAL,
            permissions.PAGE.PLAYBOOK,
            permissions.PAGE.NOTEBOOK,
            permissions.FEATURES.RUNNING_PNL,
            permissions.FEATURES.INTELLIGENCE_INSIGHTS,
            permissions.FEATURES.AI_ASSISTANT,
            permissions.FEATURES.TRADE_SHARING,
            permissions.PAGE.COMMUNITY,
            permissions.FEATURES.COMMUNITY_CHAT,
            permissions.FEATURES.COMMUNITY_GROUP,
            permissions.FEATURES.PRIVATE_ACCOUNT_POSSIBILITY,
            permissions.FEATURES.PUBLIC_ACCOUNT_POSSIBILITY,
            permissions.FEATURES.USER_GUIDES,
            permissions.FEATURES.WEEKLY_EMAIL_REPORT,
            permissions.FEATURES.MAX_ACCOUNTS_UNLIMITED
        ],
        "localizedContent": {
            "en": {
                "name": "Gold",
                "description": "Best suited for advanced traders",
                "features": [
                    "Unlimited Accounts",
                    "Daily Reports",
                    "Trading Journal",
                    "Community",
                    "Intelligence Insights",
                    "AI Assistant"
                ],
            },
            "de": {
                "name": "Gold",
                "description": "Für fortgeschrittene Trader am besten geeignet",
                "features": [
                    "Unbegrenzte Konten",
                    "Tägliche Berichte",
                    "Handelsjournal",
                    "Gemeinschaft",
                    "Intelligente Prozesseinblicke",
                    "KI-Assistent"
                ],
            }
        },
        "discount": {
            "year": {
                "first": 20
            }
        }
    }
]

module.exports = packages;