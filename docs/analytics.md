# PostHog UX 분석 이벤트

이벤트는 기능 사용량보다 사용자가 `부스를 찾고 → 확인하고 → 저장하고 → 동선을 활용하는지`를 분석하는 데 맞춘다. 검색어와 메모 본문은 수집하지 않는다.

## 핵심 분석

| 분석 질문 | 이벤트/조건 | 주요 속성 |
| --- | --- | --- |
| 검색이 실제 부스 확인으로 이어지는가? | `booth_search_completed` → `booth_viewed` (`source = search_results`) | `result_count`, `has_results`, `position` |
| 사용자는 어디서 부스를 발견하는가? | `booth_viewed` | `source`, `booth_id` |
| 부스 확인이 저장으로 이어지는가? | `booth_viewed` → `booth_save_changed` (`action = add`) | `source`, `saved_count` |
| 저장한 부스로 동선을 계획하는가? | `booth_save_changed` → `route_viewed` → `route_reordered` | `surface`, `saved_count` |
| 지도 위 동선 표시가 사용되는가? | `route_map_visibility_changed` (`visible = true`) | `saved_count`, `surface` |
| 현장에서 기록 기능을 쓰는가? | `booth_memo_saved`, `booth_photo_changed` | `has_content`, `photo_count` |
| 사진 첨부가 실패하는 이유는 무엇인가? | `booth_photo_failed` | `reason` |

## 이벤트 명세

- `booth_search_completed`: 검색 입력이 800ms 멈췄거나 결과를 선택했을 때 1회 기록한다.
- `booth_viewed`: 지도, 검색 결과, 전체 목록, PC/모바일 동선에서 부스 상세를 열 때 기록한다.
- `booth_save_changed`: 관심 부스를 추가하거나 제거할 때 기록한다.
- `route_viewed`: PC 동선 탭 또는 모바일 동선 시트를 열 때 기록한다.
- `route_reordered`: 저장한 부스 순서를 실제로 변경했을 때 기록한다.
- `route_map_visibility_changed`: PC 지도 또는 모바일 컨트롤에서 동선 표시를 켜거나 끌 때 기록한다.
- `map_control_used`: 확대, 축소, 전체 보기 버튼 사용을 기록한다. 제스처 기반 이동/확대는 과다 수집을 피하기 위해 제외한다.
- `booth_memo_saved`: 입력이 1.5초 멈췄을 때 본문 대신 글자 수만 기록한다.
- `booth_photo_changed`: 사진 추가/삭제가 저장된 뒤 기록한다.
- `booth_photo_failed`: 사진 추가가 실패했을 때 사유를 기록한다.

## 권장 PostHog 대시보드

1. 검색 성공률: `booth_search_completed` 중 `has_results = true` 비율
2. 검색 선택 전환율: `booth_search_completed` → `booth_viewed(source = search_results)` 퍼널
3. 부스 저장 전환율: `booth_viewed` → `booth_save_changed(action = add)` 퍼널, `source`별 분해
4. 동선 활용률: `booth_save_changed(action = add)` → `route_viewed` → `route_reordered` 퍼널
5. 기록 기능 이용자: `booth_memo_saved` 또는 `booth_photo_changed` 고유 사용자 추이
