from __future__ import annotations

import pandas as pd

from prep_paths import DASHBOARD_ROOT, WORK_ROOT

ROOT = DASHBOARD_ROOT
BY_MONTH_DIR = ROOT / "data" / "by-month"
GENRE_NAMES = ROOT / "data" / "genre_names.csv"
NEW_GENRE_NAMES = WORK_ROOT / "new_genre_names_jp.csv"
FILTER_OPTIONS = ROOT / "data" / "filter_options.csv"


ENGLISH = {
    "ノートPC": "Laptop computers",
    "日本茶": "Japanese tea",
    "ブラシ・くし": "Brushes and combs",
    "ティッシュペーパー": "Tissue paper",
    "ハンガー": "Hangers",
    "その他": "Other",
    "石けん・ボディソープ": "Soap and body wash",
    "その他美容・健康家電": "Other beauty and health appliances",
    "カメラ用交換レンズ": "Interchangeable camera lenses",
    "カニ": "Crab",
    "サーロイン": "Sirloin",
    "バラ・カルビ": "Short rib and kalbi",
    "モモ": "Round meat",
    "ラーメン": "Ramen",
    "ビール": "Beer",
    "野菜・果実飲料": "Vegetable and fruit drinks",
    "ワンピース": "Dresses",
    "スカート": "Skirts",
    "ブラジャー": "Bras",
    "ハンドバッグ": "Handbags",
    "ショルダーバッグ・メッセンジャーバッグ": "Shoulder and messenger bags",
    "トートバッグ": "Tote bags",
    "バックパック・リュック": "Backpacks and rucksacks",
    "ネックレス・ペンダント": "Necklaces and pendants",
    "ピアス": "Earrings",
    "香水・フレグランス": "Perfume and fragrance",
    "防災セット・非常用持ちだし袋": "Emergency kits and go bags",
    "ミックスセット": "Mixed sets",
    "ベビーサークル・プレイヤード": "Baby playpens and playards",
    "モンブラン": "Mont blanc cakes",
    "ボンボンショコラ": "Bonbon chocolates",
    "コーヒー豆": "Coffee beans",
    "ドライバー": "Drivers",
    "アイアン": "Irons",
    "パター": "Putters",
    "妊娠線ケアクリーム": "Stretch mark care cream",
    "冷蔵庫": "Refrigerators",
    "空気清浄機": "Air purifiers",
    "歯磨き粉": "Toothpaste",
    "みかん": "Mandarin oranges",
    "はちみつ梅": "Honey pickled plums",
    "ランニングマシン": "Treadmills",
    "敷布団": "Japanese floor mattresses",
    "タオルケット": "Towel blankets",
    "ロールスクリーン": "Roller blinds",
    "クッション": "Cushions",
    "オフィスデスク": "Office desks",
    "パーテーション": "Partitions",
    "ホワイトボード": "Whiteboards",
    "スタンダード": "Standard",
    "スニーカー": "Sneakers",
    "メンズベルト": "Men's belts",
    "ラム": "Lamb",
    "麦焼酎": "Barley shochu",
    "いも焼酎": "Sweet potato shochu",
    "デンタルフロス": "Dental floss",
    "布団乾燥機": "Futon dryers",
    "トナー": "Toner",
    "ダイニングセット": "Dining sets",
    "洗濯用洗剤": "Laundry detergent",
    "ペティナイフ": "Petty knives",
    "シャンプー": "Shampoo",
    "トリートメント": "Hair treatments",
    "冷凍庫": "Freezers",
    "浄水器・整水器用交換フィルター": "Water purifier replacement filters",
    "麻雀卓": "Mahjong tables",
    "スーツケース・キャリーバッグ": "Suitcases and carry-on bags",
    "醤油イクラ": "Soy sauce marinated salmon roe",
    "プリザーブドフラワー": "Preserved flowers",
    "ダイニングテーブル": "Dining tables",
    "ダイニングチェア": "Dining chairs",
    "スツール": "Stools",
    "ハンガーラック・コートハンガー": "Hanger racks and coat hangers",
    "タイルカーペット・ジョイントマット": "Tile carpets and joint mats",
    "ゴミ箱": "Trash cans",
    "フライパン": "Frying pans",
    "まな板・カッティングボード": "Cutting boards",
    "パンプス": "Pumps",
    "化粧水・ローション": "Face lotion",
    "美容液": "Beauty serum",
    "フェイスカラー・パウダー": "Face color and powder",
    "収納ケース・ボックス": "Storage cases and boxes",
    "シーリングライト・天井直付灯": "Ceiling lights",
    "ドレープカーテン": "Drape curtains",
    "レースカーテン": "Lace curtains",
    "会議用チェア": "Conference chairs",
    "メンズ腕時計": "Men's watches",
    "レディース腕時計": "Women's watches",
    "腕時計用ベルト・バンド": "Watch straps and bands",
    "テント": "Tents",
    "マザーズバッグ": "Maternity bags",
    "Tシャツ・カットソー": "T-shirts and cut-and-sew tops",
    "スウェット・トレーナー": "Sweatshirts",
    "セット・詰め合わせ": "Sets and assortments",
    "アイスクリーム": "Ice cream",
    "干しいも": "Dried sweet potatoes",
    "ハンドクリーム": "Hand cream",
    "タンス・チェスト": "Dressers and chests",
    "壁紙": "Wallpaper",
    "会議用テーブル": "Conference tables",
    "キッチンクロス": "Kitchen cloths",
    "大人用マスク": "Adult masks",
    "靴下": "Socks",
    "カーディガン・ボレロ": "Cardigans and boleros",
    "ポロシャツ": "Polo shirts",
    "人工観葉植物": "Artificial houseplants",
    "メロン": "Melons",
    "クレンジングオイル": "Cleansing oil",
    "洗顔フォーム": "Face wash foam",
    "ランドリー・サニタリーチェスト": "Laundry and sanitary chests",
    "ランドリーボックス・バスケット": "Laundry boxes and baskets",
    "タンブラー": "Tumblers",
    "カラコン・サークルレンズ": "Colored contact lenses",
    "チューハイ": "Chuhai",
    "コーヒー飲料": "Coffee drinks",
    "ガム": "Gum",
    "マット": "Mats",
    "和風おせちセット": "Japanese osechi sets",
    "インクカートリッジ": "Ink cartridges",
    "レディース財布": "Women's wallets",
    "オーブンレンジ": "Microwave ovens",
    "ヘアドライヤー": "Hair dryers",
    "各種クッキー・焼き菓子セット": "Cookie and baked sweet sets",
    "シートマスク・フェイスパック": "Sheet masks and face packs",
    "超音波美顔器": "Ultrasonic facial devices",
    "手用歯ブラシ": "Manual toothbrushes",
    "玄米": "Brown rice",
    "アウトバストリートメント": "Leave-in hair treatments",
    "マットレス": "Mattresses",
    "エコバッグ": "Reusable shopping bags",
    "ストレートアイロン": "Hair straighteners",
    "ナイトウェア・ルームウェア": "Nightwear and loungewear",
    "ベッドパッド・敷きパッド": "Bed pads",
    "マウスパッド": "Mouse pads",
    "メンズ財布": "Men's wallets",
    "交換フィルター": "Replacement filters",
    "ソファベッド": "Sofa beds",
    "コート・ジャケット": "Coats and jackets",
    "生肉": "Raw meat",
    "土鍋": "Donabe clay pots",
    "PCバッグ・スリーブ": "PC bags and sleeves",
    "タブレットPC本体": "Tablet computers",
    "タブレットカバー・ケース": "Tablet covers and cases",
    "内蔵SSD": "Internal SSDs",
    "スマートフォン本体": "Smartphones",
    "液晶保護フィルム": "Screen protectors",
    "スカルプケアローション・エッセンス": "Scalp care lotions and essences",
    "ノンアルコール": "Non-alcoholic drinks",
    "フラッシュ式脱毛器": "IPL hair removal devices",
    "食器棚・キッチンボード": "Cupboards and kitchen boards",
    "白ワイン": "White wine",
    "オールインワン化粧品": "All-in-one cosmetics",
    "テレビ": "Televisions",
    "ソフトコンタクトレンズ": "Soft contact lenses",
    "子供用ヘルメット・プロテクター": "Children's helmets and protectors",
    "モバイルバッテリー": "Portable batteries",
    "スマートフォン・タブレット用ケーブル・変換アダプター": "Smartphone and tablet cables and adapters",
    "ドレス": "Dresses",
    "保存容器・キャニスター": "Storage containers and canisters",
    "掃除機": "Vacuum cleaners",
    "ルームエアコン": "Room air conditioners",
    "電気こたつ": "Electric kotatsu",
    "ドア": "Doors",
    "クッションフロア": "Cushion flooring",
    "フローリング・床のリフォーム": "Flooring renovation",
    "ドアまわり防犯用品": "Door security goods",
    "牧草": "Hay",
    "ドッグフード": "Dog food",
    "大人用バット": "Adult baseball bats",
    "ハイボール": "Highballs",
    "セーター": "Sweaters",
    "皿・プレート": "Plates",
    "マグカップ": "Mugs",
    "ソファ": "Sofas",
    "安全靴": "Safety shoes",
    "交換用バッテリー・充電池": "Replacement batteries",
    "飲み比べセット": "Tasting sets",
    "セット": "Sets",
    "和洋おせちセット": "Japanese-Western osechi sets",
    "和洋中おせちセット": "Japanese-Western-Chinese osechi sets",
    "ホエイプロテイン": "Whey protein",
    "ジャパニーズ・ウイスキー": "Japanese whisky",
    "赤ワインセット": "Red wine sets",
    "ブレンデッド・ウイスキー": "Blended whisky",
    "セクシーランジェリー": "Sexy lingerie",
    "クッションファンデーション": "Cushion foundation",
    "フォームローラー": "Foam rollers",
    "クレンジングバーム": "Cleansing balm",
    "本体": "Main units",
    "ベビーマット・お昼寝マット・プレイマット": "Baby mats / nap mats / play mats",
}


def label_for(japanese: str) -> str:
    english = ENGLISH.get(japanese, japanese)
    return f"{japanese} ({english})"


def read_monthly_actuals() -> pd.DataFrame:
    frames = []
    for path in sorted(BY_MONTH_DIR.glob("*.csv")):
        frame = pd.read_csv(path, usecols=["date", "shop", "genre", "sales"], dtype={"genre": "string", "shop": "string"})
        frame["sales"] = pd.to_numeric(frame["sales"], errors="coerce").fillna(0)
        frames.append(frame)
    if not frames:
        raise SystemExit("No by-month CSV files found")
    return pd.concat(frames, ignore_index=True)


def main() -> None:
    actuals = read_monthly_actuals()
    by_genre = actuals.groupby("genre", as_index=False)["sales"].sum()
    by_date = actuals.groupby("date", as_index=False)["sales"].sum()

    existing = pd.read_csv(GENRE_NAMES, dtype=str)
    names = dict(zip(existing["genre_id"].astype(str), existing["genre_name"].astype(str)))
    if NEW_GENRE_NAMES.exists():
        new_names = pd.read_csv(NEW_GENRE_NAMES, dtype=str).fillna("")
        for row in new_names.itertuples(index=False):
            if row.jp_name:
                names[str(row.genre_id)] = label_for(str(row.jp_name))

    genre_rows = []
    for row in by_genre.itertuples(index=False):
        genre = str(row.genre)
        genre_rows.append({
            "type": "genre",
            "id": genre,
            "label": names.get(genre, f"Genre {genre}"),
            "sales": round(float(row.sales), 2),
        })
    genre_rows.sort(key=lambda row: (-row["sales"], row["label"]))

    date_rows = [
        {
            "type": "date",
            "id": row.date,
            "label": row.date,
            "sales": round(float(row.sales), 2),
        }
        for row in by_date.itertuples(index=False)
    ]
    date_rows.sort(key=lambda row: (-row["sales"], row["id"]))

    option_rows = date_rows + genre_rows
    pd.DataFrame(option_rows, columns=["type", "id", "label", "sales"]).to_csv(FILTER_OPTIONS, index=False)

    name_rows = [{"genre_id": genre, "genre_name": names.get(genre, f"Genre {genre}")} for genre in sorted(by_genre["genre"].astype(str).unique())]
    pd.DataFrame(name_rows).to_csv(GENRE_NAMES, index=False)
    print(f"wrote {len(date_rows):,} date options and {len(genre_rows):,} genre options")


if __name__ == "__main__":
    main()
