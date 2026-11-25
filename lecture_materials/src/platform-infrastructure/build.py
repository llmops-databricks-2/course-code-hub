"""Assemble lecture_materials/PLATFORM-UNDER-THE-WORKSPACE.html from the parts in this folder.

    python3 lecture_materials/src/platform-infrastructure/build.py

head.html (the <head> and base styles of the course's supplementary pages), extra.css, scene.css,
body.html, lockup.svg, the generated drawing request-path.html, page.js and scene.js (the animated
"day on the platform", with its vendor marks in scene-icons.svg). Never edit the built page by hand.
"""

from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "PLATFORM-UNDER-THE-WORKSPACE.html"
DOCS = [
    ("getting-started/high-level-architecture", "High-level architecture"),
    ("admin/admin-concepts", "Admin roles"),
    ("admin/users-groups/", "Users, service principals and groups"),
    ("security/auth/entitlements", "Entitlements"),
    ("data-governance/unity-catalog/manage-privileges/privileges", "Unity Catalog privileges"),
    ("dev-tools/auth/provider-github", "GitHub Actions federation"),
    ("dev-tools/", "Developer tools"),
    ("dev-tools/bundles/", "Declarative Automation Bundles"),
    ("admin/disaster-recovery", "Disaster recovery"),
]


def main() -> None:
    read = lambda name: (HERE / name).read_text()  # noqa: E731
    drawing = HERE / "request-path.html"
    body = read("body.html").replace("<!--lockup-->", read("lockup.svg"))
    if drawing.exists():
        body = body.replace(
            "<!--request-path:start--><!--request-path:end-->",
            f"<!--request-path:start-->\n{drawing.read_text()}\n<!--request-path:end-->",
        )
    # The course-assistant setup, copied from that repo's figures, opens the onboarding view.
    figures = HERE / "figures"
    setup = (
        '<h3 style="margin-top:4px">How course-assistant is set up</h3>'
        "<p>Three automated parts share one state, the <code>course_ops</code> tables: the daily "
        "onboarding run (GitHub Actions, as <code>sp-onboarding-llmops</code>) provisions each "
        "student and renders their repository; the student's repository deploys their own bundle "
        "as their own principals; and the monitoring bundle reads the system tables for the "
        "teachers' dashboard and Genie agent. Every workflow signs in by OIDC.</p>"
        f'<div class="mapbox setup-fig">{(figures / "system-overview.html").read_text()}</div>'
        '<details class="fold"><summary>Show one onboarding run, system by system</summary>'
        f'<div class="mapbox setup-fig">{(figures / "onboarding-workflow-sequence.html").read_text()}'
        "</div></details>"
        '<p class="note">Figures from the <code>course-assistant</code> repository, '
        "<code>docs/figures/</code>.</p>"
        '<h3 style="margin-top:8px">Try it: three students, four days</h3>'
    )
    anchor = '<div class="row">\n    <label class="chk"><input type="checkbox" id="fQuota"'
    if anchor not in body:
        raise SystemExit("build: the onboarding view's anchor moved; update build.py")
    body = body.replace(anchor, setup + anchor, 1)
    body = (figures / "sprite.svg").read_text() + read("scene-icons.svg") + body
    links = " · ".join(f'<a href="https://docs.databricks.com/aws/en/{p}">{t}</a>' for p, t in DOCS)
    body = body.replace("<!--docs-->", links)
    page = (
        read("head.html")
        + read("extra.css")
        + read("scene.css")
        + "</style>\n</head>\n<body>\n"
        + body
        + "\n<script>\n"
        + read("page.js")
        + read("scene.js")
        + "</script>\n</body>\n</html>\n"
    )
    OUT.write_text(page)
    print(f"wrote {OUT.name}: {len(page)} bytes, drawing {'in' if drawing.exists() else 'missing'}")


if __name__ == "__main__":
    main()
