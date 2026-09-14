from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys


@dataclass
class YamlLine:
    number: int
    indent: int
    content: str


class YamlParseError(Exception):
    def __init__(self, message: str, line_number: int) -> None:
        super().__init__(message)
        self.line_number = line_number


class SimpleYamlParser:
    def __init__(self, text: str) -> None:
        self.lines = self._prepare_lines(text)
        self.index = 0

    def parse(self):
        if not self.lines:
            return None
        value = self._parse_block(self.lines[0].indent)
        if self.index != len(self.lines):
            line = self.lines[self.index]
            raise YamlParseError("存在未預期的剩餘內容", line.number)
        return value

    def _prepare_lines(self, text: str) -> list[YamlLine]:
        prepared: list[YamlLine] = []
        for number, raw_line in enumerate(text.splitlines(), start=1):
            if not raw_line.strip():
                continue
            stripped = raw_line.lstrip(" ")
            if stripped.startswith("#"):
                continue
            indent = len(raw_line) - len(stripped)
            prepared.append(YamlLine(number=number, indent=indent, content=stripped))
        return prepared

    def _parse_block(self, indent: int):
        if self.index >= len(self.lines):
            return None
        line = self.lines[self.index]
        if line.indent != indent:
            raise YamlParseError("縮排層級不正確", line.number)
        if line.content.startswith("- "):
            return self._parse_list(indent)
        return self._parse_dict(indent)

    def _parse_dict(self, indent: int) -> dict:
        result: dict = {}
        while self.index < len(self.lines):
            line = self.lines[self.index]
            if line.indent < indent:
                break
            if line.indent > indent:
                raise YamlParseError("字典項目出現未預期的縮排", line.number)
            key, raw_value = self._split_key_value(line.content, line.number)
            if key in result:
                raise YamlParseError(f"重複的 key: {key}", line.number)
            self.index += 1
            if raw_value == "":
                if self.index < len(self.lines) and self.lines[self.index].indent > indent:
                    value = self._parse_block(self.lines[self.index].indent)
                else:
                    value = None
            else:
                value = self._parse_scalar(raw_value, line.number)
            result[key] = value
        return result

    def _parse_list(self, indent: int) -> list:
        result: list = []
        while self.index < len(self.lines):
            line = self.lines[self.index]
            if line.indent < indent:
                break
            if line.indent > indent:
                raise YamlParseError("清單項目出現未預期的縮排", line.number)
            if not line.content.startswith("- "):
                raise YamlParseError("清單項目必須以 - 開頭", line.number)

            item_content = line.content[2:].strip()
            self.index += 1

            if item_content == "":
                if self.index < len(self.lines) and self.lines[self.index].indent > indent:
                    result.append(self._parse_block(self.lines[self.index].indent))
                else:
                    result.append(None)
                continue

            split = self._try_split_key_value(item_content, line.number)
            if split is not None:
                key, raw_value = split
                item: dict = {}
                if raw_value == "":
                    if self.index < len(self.lines) and self.lines[self.index].indent > indent:
                        item[key] = self._parse_block(self.lines[self.index].indent)
                    else:
                        item[key] = None
                else:
                    item[key] = self._parse_scalar(raw_value, line.number)

                if self.index < len(self.lines) and self.lines[self.index].indent > indent:
                    extra = self._parse_block(self.lines[self.index].indent)
                    if not isinstance(extra, dict):
                        raise YamlParseError("清單中的物件結構不正確", self.lines[self.index - 1].number)
                    duplicated = set(item).intersection(extra)
                    if duplicated:
                        raise YamlParseError(f"清單物件內有重複 key: {sorted(duplicated)[0]}", self.lines[self.index - 1].number)
                    item.update(extra)

                result.append(item)
                continue

            result.append(self._parse_scalar(item_content, line.number))
        return result

    def _split_key_value(self, text: str, line_number: int) -> tuple[str, str]:
        split = self._try_split_key_value(text, line_number)
        if split is None:
            raise YamlParseError("找不到有效的 key: value 結構", line_number)
        return split

    def _try_split_key_value(self, text: str, line_number: int) -> tuple[str, str] | None:
        in_single = False
        in_double = False
        for index, char in enumerate(text):
            if char == "'" and not in_double:
                in_single = not in_single
            elif char == '"' and not in_single:
                in_double = not in_double
            elif char == ":" and not in_single and not in_double:
                key = text[:index].strip()
                value = text[index + 1 :].strip()
                if not key:
                    raise YamlParseError("空白的 key", line_number)
                return key, value
        return None

    def _parse_scalar(self, value: str, line_number: int):
        if value == "null":
            return None
        if value == "[]":
            return []
        if value == "{}":
            return {}
        if value == "true":
            return True
        if value == "false":
            return False
        if value.startswith('"') and value.endswith('"'):
            return self._unquote_double(value[1:-1])
        if value.startswith("'") and value.endswith("'"):
            return value[1:-1].replace("''", "'")
        if value.isdigit() or (value.startswith("-") and value[1:].isdigit()):
            return int(value)
        return value

    def _unquote_double(self, value: str) -> str:
        return (
            value.replace('\\"', '"')
            .replace("\\\\", "\\")
            .replace("\\n", "\n")
            .replace("\\t", "\t")
        )


def parse_yaml_file(path: Path):
    text = path.read_text(encoding="utf-8")
    parser = SimpleYamlParser(text)
    return parser.parse()


def ensure_list(value, path: str, errors: list[str]) -> list:
    if isinstance(value, list):
        return value
    errors.append(f"{path} 應為清單")
    return []


def ensure_dict(value, path: str, errors: list[str]) -> dict:
    if isinstance(value, dict):
        return value
    errors.append(f"{path} 應為物件")
    return {}


def validate_required_fields(items: list, required_fields: list[str], root_path: str, errors: list[str]) -> None:
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            errors.append(f"{root_path}[{index}] 應為物件")
            continue
        for field in required_fields:
            if field not in item:
                errors.append(f"{root_path}[{index}].{field} 缺少欄位")


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    data_dir = project_root / "data"

    file_map = {
        "itinerary": data_dir / "itinerary.yaml",
        "restaurants": data_dir / "restaurants.yaml",
        "places": data_dir / "places.yaml",
        "transportation": data_dir / "transportation.yaml",
    }

    parsed: dict[str, object] = {}
    errors: list[str] = []

    for name, path in file_map.items():
        try:
            parsed[name] = parse_yaml_file(path)
        except FileNotFoundError:
            errors.append(f"{path.name} 找不到檔案")
        except YamlParseError as exc:
            errors.append(f"{path.name}:{exc.line_number} YAML 解析失敗：{exc}")
        except Exception as exc:
            errors.append(f"{path.name} 解析失敗：{exc}")

    if errors:
        for error in errors:
            print(error)
        return 1

    itinerary_root = ensure_dict(parsed["itinerary"], "data/itinerary.yaml", errors)
    restaurants_root = ensure_dict(parsed["restaurants"], "data/restaurants.yaml", errors)
    places_root = ensure_dict(parsed["places"], "data/places.yaml", errors)
    transportation_root = ensure_dict(parsed["transportation"], "data/transportation.yaml", errors)

    itinerary_days = ensure_list(itinerary_root.get("itinerary"), "data/itinerary.yaml.itinerary", errors)
    restaurants = ensure_list(restaurants_root.get("restaurants"), "data/restaurants.yaml.restaurants", errors)
    places = ensure_list(places_root.get("places"), "data/places.yaml.places", errors)
    transportation_days = ensure_list(transportation_root.get("transportation", {}).get("days"), "data/transportation.yaml.transportation.days", errors)
    online_booking = ensure_list(
        transportation_root.get("transportation", {}).get("online_booking_recommendations"),
        "data/transportation.yaml.transportation.online_booking_recommendations",
        errors,
    )
    ticket_links_root = ensure_list(
        transportation_root.get("transportation", {}).get("ticket_links"),
        "data/transportation.yaml.transportation.ticket_links",
        errors,
    )
    on_site_segments = ensure_list(
        transportation_root.get("transportation", {}).get("on_site_or_ic_card_segments"),
        "data/transportation.yaml.transportation.on_site_or_ic_card_segments",
        errors,
    )

    validate_required_fields(
        restaurants,
        ["id", "date", "area", "meal_type", "priority", "name", "google_maps_url", "lat", "lng"],
        "data/restaurants.yaml.restaurants",
        errors,
    )
    validate_required_fields(
        places,
        ["id", "name", "area", "category", "lat", "lng"],
        "data/places.yaml.places",
        errors,
    )
    validate_required_fields(
        transportation_days,
        ["date", "title", "route_summary", "segments", "ticket_links", "warnings", "codex_notes"],
        "data/transportation.yaml.transportation.days",
        errors,
    )
    validate_required_fields(
        online_booking,
        ["date", "purchase_site", "purchase_url", "route", "train_type", "reserved_seat", "notes"],
        "data/transportation.yaml.transportation.online_booking_recommendations",
        errors,
    )
    validate_required_fields(
        ticket_links_root,
        ["name", "url", "applies_to", "note"],
        "data/transportation.yaml.transportation.ticket_links",
        errors,
    )
    validate_required_fields(
        on_site_segments,
        ["date", "title", "method", "purchase_method", "estimated_time", "reservation_required", "notes"],
        "data/transportation.yaml.transportation.on_site_or_ic_card_segments",
        errors,
    )

    restaurant_ids: set[str] = set()
    place_ids: set[str] = set()

    for index, restaurant in enumerate(restaurants):
        if isinstance(restaurant, dict):
            restaurant_id = restaurant.get("id")
            if restaurant_id is None:
                continue
            if restaurant_id in restaurant_ids:
                errors.append(f"data/restaurants.yaml.restaurants[{index}].id 重複：{restaurant_id}")
            restaurant_ids.add(restaurant_id)

    for index, place in enumerate(places):
        if isinstance(place, dict):
            place_id = place.get("id")
            if place_id is None:
                continue
            if place_id in place_ids:
                errors.append(f"data/places.yaml.places[{index}].id 重複：{place_id}")
            place_ids.add(place_id)

    for day_index, day in enumerate(itinerary_days):
        if not isinstance(day, dict):
            errors.append(f"data/itinerary.yaml.itinerary[{day_index}] 應為物件")
            continue

        timeline = day.get("timeline")
        if not isinstance(timeline, list):
            errors.append(f"data/itinerary.yaml.itinerary[{day_index}].timeline 應為清單")
            continue

        for timeline_index, item in enumerate(timeline):
            if not isinstance(item, dict):
                errors.append(f"data/itinerary.yaml.itinerary[{day_index}].timeline[{timeline_index}] 應為物件")
                continue

            related_restaurant_ids = item.get("related_restaurant_ids", [])
            related_place_ids = item.get("related_place_ids", [])

            if not isinstance(related_restaurant_ids, list):
                errors.append(
                    f"data/itinerary.yaml.itinerary[{day_index}].timeline[{timeline_index}].related_restaurant_ids 應為清單"
                )
            else:
                for ref_index, restaurant_id in enumerate(related_restaurant_ids):
                    if restaurant_id not in restaurant_ids:
                        errors.append(
                            "data/itinerary.yaml.itinerary"
                            f"[{day_index}].timeline[{timeline_index}].related_restaurant_ids[{ref_index}] "
                            f"找不到對應餐廳 id：{restaurant_id}"
                        )

            if not isinstance(related_place_ids, list):
                errors.append(
                    f"data/itinerary.yaml.itinerary[{day_index}].timeline[{timeline_index}].related_place_ids 應為清單"
                )
            else:
                for ref_index, place_id in enumerate(related_place_ids):
                    if place_id not in place_ids:
                        errors.append(
                            "data/itinerary.yaml.itinerary"
                            f"[{day_index}].timeline[{timeline_index}].related_place_ids[{ref_index}] "
                            f"找不到對應地點 id：{place_id}"
                        )

        meals = day.get("meals")
        if not isinstance(meals, list):
            errors.append(f"data/itinerary.yaml.itinerary[{day_index}].meals 應為清單")
        else:
            for meal_index, meal in enumerate(meals):
                if not isinstance(meal, dict):
                    errors.append(f"data/itinerary.yaml.itinerary[{day_index}].meals[{meal_index}] 應為物件")
                    continue
                for field in ("primary_restaurant_ids", "backup_restaurant_ids"):
                    restaurant_refs = meal.get(field, [])
                    if not isinstance(restaurant_refs, list):
                        errors.append(
                            f"data/itinerary.yaml.itinerary[{day_index}].meals[{meal_index}].{field} 應為清單"
                        )
                        continue
                    for ref_index, restaurant_id in enumerate(restaurant_refs):
                        if restaurant_id not in restaurant_ids:
                            errors.append(
                                f"data/itinerary.yaml.itinerary[{day_index}].meals[{meal_index}].{field}[{ref_index}] "
                                f"找不到對應餐廳 id：{restaurant_id}"
                            )

    itinerary_dates = {
        day.get("date")
        for day in itinerary_days
        if isinstance(day, dict)
    }

    for day_index, day in enumerate(transportation_days):
        if not isinstance(day, dict):
            errors.append(f"data/transportation.yaml.transportation.days[{day_index}] 應為物件")
            continue

        date = day.get("date")
        if date not in itinerary_dates:
            errors.append(f"data/transportation.yaml.transportation.days[{day_index}].date 找不到對應行程日期：{date}")

        segments = day.get("segments")
        if not isinstance(segments, list):
            errors.append(f"data/transportation.yaml.transportation.days[{day_index}].segments 應為清單")
        else:
            validate_required_fields(
                segments,
                [
                    "from",
                    "to",
                    "method",
                    "operator",
                    "train_type",
                    "estimated_time",
                    "ticket_type",
                    "purchase_site",
                    "purchase_url",
                    "purchase_method",
                    "reservation_recommended",
                    "payment_note",
                    "ic_card_note",
                    "notes",
                ],
                f"data/transportation.yaml.transportation.days[{day_index}].segments",
                errors,
            )

        day_ticket_links = day.get("ticket_links")
        if not isinstance(day_ticket_links, list):
            errors.append(f"data/transportation.yaml.transportation.days[{day_index}].ticket_links 應為清單")
        else:
            validate_required_fields(
                day_ticket_links,
                ["name", "url", "applies_to", "note"],
                f"data/transportation.yaml.transportation.days[{day_index}].ticket_links",
                errors,
            )

        for key in ("warnings", "codex_notes"):
            if not isinstance(day.get(key), list):
                errors.append(f"data/transportation.yaml.transportation.days[{day_index}].{key} 應為清單")

        journey_plans = day.get("journey_plans")
        if journey_plans is not None:
            if not isinstance(journey_plans, list):
                errors.append(f"data/transportation.yaml.transportation.days[{day_index}].journey_plans 應為清單")
            else:
                validate_required_fields(
                    journey_plans,
                    ["label", "status", "legs", "notes"],
                    f"data/transportation.yaml.transportation.days[{day_index}].journey_plans",
                    errors,
                )
                for plan_index, plan in enumerate(journey_plans):
                    if not isinstance(plan, dict):
                        continue
                    legs = plan.get("legs")
                    if not isinstance(legs, list):
                        errors.append(
                            f"data/transportation.yaml.transportation.days[{day_index}].journey_plans[{plan_index}].legs 應為清單"
                        )
                        continue
                    validate_required_fields(
                        legs,
                        [
                            "service_name",
                            "from",
                            "to",
                            "departure_time",
                            "arrival_time",
                            "status",
                            "purchase_site",
                            "purchase_url",
                        ],
                        f"data/transportation.yaml.transportation.days[{day_index}].journey_plans[{plan_index}].legs",
                        errors,
                    )

    if errors:
        for error in errors:
            print(error)
        return 1

    print("資料驗證通過，可以進入 PDF 製作階段。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
