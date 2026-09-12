"""Render assets/writing/dictionary.json into writing.html as static markup.

Usage: python tools/build_writing.py
The list is written between the writing-list:start/end markers, newest first.
"""
import html
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "writing" / "dictionary.json"
PAGE = ROOT / "writing.html"
START, END = "<!-- writing-list:start -->", "<!-- writing-list:end -->"

# Credits folded into some titles ("Ft. ...", "Co-authored with ...") render as a note.
NOTE = re.compile(r"\s+((?:Ft\.|Co-authored)\s.*)$")


def esc(value):
    return html.escape(value.strip(), quote=True)


def render(article):
    date = datetime.strptime(article["date"], "%m/%d/%Y")
    title = article["article title"].strip()
    note = ""
    match = NOTE.search(title)
    if match:
        title = title[: match.start()]
        note = f'\n        <p class="article-note">{esc(match.group(1))}</p>'
    keywords = "".join(f'<li class="keyword">{esc(k)}</li>' for k in article["keywords"])
    return f"""      <li class="article-item">
        <p class="article-meta"><span>{esc(article['outlet'])}</span> <time datetime="{date:%Y-%m-%d}">{date:%B} {date.day}, {date.year}</time></p>
        <h2><a href="{esc(article['link'])}">{esc(title)}</a></h2>{note}
        <ul class="keywords" aria-label="Topics">{keywords}</ul>
      </li>"""


def main():
    articles = json.loads(DATA.read_text(encoding="utf-8"))
    articles.sort(key=lambda a: datetime.strptime(a["date"], "%m/%d/%Y"), reverse=True)
    items = "\n".join(render(a) for a in articles)

    page = PAGE.read_text(encoding="utf-8")
    head, rest = page.split(START, 1)
    _, tail = rest.split(END, 1)
    PAGE.write_text(f"{head}{START}\n{items}\n{END}{tail}", encoding="utf-8", newline="\n")
    print(f"Wrote {len(articles)} articles to {PAGE.name}")


if __name__ == "__main__":
    main()
