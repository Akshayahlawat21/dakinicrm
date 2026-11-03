"""
Dakini CRM - Professional RBAC & Database Architecture PDF Generator
Builds a high-quality PDF report covering the 3-tier RBAC Matrix and Table Relationships.
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to calculate total page count and draw running headers/footers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running Header
        self.drawString(40, 11 * 72 - 28, "DAKINI CRM - RBAC & DATABASE ARCHITECTURE REPORT")
        self.drawRightString(8.5 * 72 - 40, 11 * 72 - 28, "CONFIDENTIAL & PROPRIETARY")
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.75)
        self.line(40, 11 * 72 - 32, 8.5 * 72 - 40, 11 * 72 - 32)

        # Running Footer
        self.line(40, 36, 8.5 * 72 - 40, 36)
        self.setFont("Helvetica", 8)
        self.drawString(40, 24, "Dakini AI Systems | Enterprise Sales Platform Architecture")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * 72 - 40, 24, page_text)
        self.restoreState()


def build_pdf(output_path: str):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=42,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()

    # Colors
    NAVY = colors.HexColor("#0f172a")
    PRIMARY = colors.HexColor("#1e3a8a")
    SECONDARY = colors.HexColor("#2563eb")
    MUTED = colors.HexColor("#64748b")
    BORDER_LIGHT = colors.HexColor("#e2e8f0")
    ROW_BG_ALT = colors.HexColor("#f8fafc")
    BADGE_GREEN = colors.HexColor("#166534")
    BADGE_RED = colors.HexColor("#991b1b")
    BADGE_BLUE = colors.HexColor("#1e40af")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=PRIMARY,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=MUTED,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=NAVY,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=SECONDARY,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#334155")
    )

    th_style = ParagraphStyle(
        'TH_Style',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=0
    )

    td_style = ParagraphStyle(
        'TD_Style',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1e293b")
    )

    td_bold = ParagraphStyle(
        'TD_Bold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=NAVY
    )

    td_owner = ParagraphStyle(
        'TD_Owner',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=BADGE_BLUE
    )

    td_mgr = ParagraphStyle(
        'TD_Mgr',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=BADGE_GREEN
    )

    td_sales = ParagraphStyle(
        'TD_Sales',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#334155")
    )

    td_forbid = ParagraphStyle(
        'TD_Forbid',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=BADGE_RED
    )

    story = []

    # Title Banner
    story.append(Paragraph("Dakini CRM - Technical Architecture Report", title_style))
    story.append(Paragraph("Generated on Live Supabase Database & Layer 3 Application Codebase | Role-Based Access Control & Relational Schema Mapping", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceBefore=0, spaceAfter=10))

    # =========================================================================
    # PART 1: RBAC MATRIX
    # =========================================================================
    story.append(Paragraph("Part 1: Role-Based Access Control (RBAC) Governance Matrix", h1_style))
    story.append(Paragraph(
        "Dakini CRM enforces a strict multi-tenant role hierarchy: <b>Owner</b> (full organization control) &rarr; "
        "<b>Manager</b> (scoped to assigned sales team members) &rarr; <b>Salesperson</b> (restricted to owned/assigned records only).",
        body_style
    ))
    story.append(Spacer(1, 6))

    rbac_headers = ["CRM Module", "Action", "Owner", "Manager", "Salesperson (Rep)"]
    rbac_rows = [
        [
            Paragraph("<b>Leads</b>", td_bold),
            Paragraph("View Leads", td_style),
            Paragraph("Full Organization", td_owner),
            Paragraph("Team Records + Assigned", td_mgr),
            Paragraph("Own Assigned Leads Only", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Unassigned Leads Pool", td_style),
            Paragraph("Full Access", td_owner),
            Paragraph("Only if Authorized", td_mgr),
            Paragraph("Strictly Forbidden", td_forbid),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Create / Ingest", td_style),
            Paragraph("Allowed", td_owner),
            Paragraph("Allowed", td_mgr),
            Paragraph("Allowed", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Edit / Status Change", td_style),
            Paragraph("Allowed", td_owner),
            Paragraph("Team Leads Only", td_mgr),
            Paragraph("Own Assigned Leads", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Assign / Reassign", td_style),
            Paragraph("To Anyone in Org", td_owner),
            Paragraph("Within Own Team Only", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Delete (Soft Delete)", td_style),
            Paragraph("Allowed", td_owner),
            Paragraph("Team Leads Only", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("<b>Deals / Opportunities</b>", td_bold),
            Paragraph("View Deals", td_style),
            Paragraph("Full Organization", td_owner),
            Paragraph("Team Deals Only", td_mgr),
            Paragraph("Own Deals Only", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Stage Progression", td_style),
            Paragraph("Any Deal in Org", td_owner),
            Paragraph("Team Deals Only", td_mgr),
            Paragraph("Own Deals Only", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Discount Limits", td_style),
            Paragraph("Unlimited (100%)", td_owner),
            Paragraph("Up to 30%", td_mgr),
            Paragraph("Up to 10%", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Approve Discounts", td_style),
            Paragraph("Allowed", td_owner),
            Paragraph("Allowed", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Delete Deals", td_style),
            Paragraph("Allowed", td_owner),
            Paragraph("Team Deals Only", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("<b>Accounts & Contacts</b>", td_bold),
            Paragraph("View / Create / Edit", td_style),
            Paragraph("Full Organization", td_owner),
            Paragraph("Full Organization", td_mgr),
            Paragraph("Full Organization", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Delete Accounts", td_style),
            Paragraph("Allowed (Exclusive)", td_owner),
            Paragraph("Forbidden (403)", td_forbid),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Delete Contacts", td_style),
            Paragraph("Allowed", td_owner),
            Paragraph("Team Contacts Only", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("<b>Tasks & Activities</b>", td_bold),
            Paragraph("View Tasks", td_style),
            Paragraph("Full Organization", td_owner),
            Paragraph("Team Members' Tasks", td_mgr),
            Paragraph("Own Tasks Only", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Assign Tasks", td_style),
            Paragraph("To Anyone in Org", td_owner),
            Paragraph("To Team Reps Only", td_mgr),
            Paragraph("To Self Only", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Delete Tasks", td_style),
            Paragraph("Allowed", td_owner),
            Paragraph("Task Creator Only", td_mgr),
            Paragraph("Task Creator Only", td_sales),
        ],
        [
            Paragraph("<b>Call Transcripts & AI</b>", td_bold),
            Paragraph("View & Analyze Calls", td_style),
            Paragraph("Full Organization", td_owner),
            Paragraph("Team Calls Only", td_mgr),
            Paragraph("Own Calls Only", td_sales),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Delete Call Analysis", td_style),
            Paragraph("Allowed (Database Purge)", td_owner),
            Paragraph("Team Calls (DB Purge)", td_mgr),
            Paragraph("Hidden / Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("<b>Campaigns</b>", td_bold),
            Paragraph("Create / Edit / Delete", td_style),
            Paragraph("Allowed", td_owner),
            Paragraph("Allowed", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("<b>Sales Targets</b>", td_bold),
            Paragraph("Set Quotas / Targets", td_style),
            Paragraph("To Managers & Reps", td_owner),
            Paragraph("To Team Reps Only", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("<b>Team Governance</b>", td_bold),
            Paragraph("Create Teams / Managers", td_style),
            Paragraph("Allowed (Exclusive)", td_owner),
            Paragraph("Forbidden (403)", td_forbid),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Manage Team Members", td_style),
            Paragraph("Any Team", td_owner),
            Paragraph("Own Team Only", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("<b>Administration & Export</b>", td_bold),
            Paragraph("Create Users / Edit Roles", td_style),
            Paragraph("Managers & Reps", td_owner),
            Paragraph("Reps in Team Only", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Reset Passwords", td_style),
            Paragraph("Any User in Org", td_owner),
            Paragraph("Team Members Only", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
        [
            Paragraph("", td_style),
            Paragraph("Export Data (CSV/PDF)", td_style),
            Paragraph("Full Organization", td_owner),
            Paragraph("Team Records Only", td_mgr),
            Paragraph("Forbidden (403)", td_forbid),
        ],
    ]

    rbac_table_data = [[Paragraph(h, th_style) for h in rbac_headers]] + rbac_rows
    col_widths_rbac = [95, 105, 110, 110, 112]

    rbac_table = Table(rbac_table_data, colWidths=col_widths_rbac, repeatRows=1)
    rbac_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_BG_ALT]),
    ]))

    story.append(rbac_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # PART 2: DATABASE RELATIONAL SCHEMA REPORT
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("Part 2: Relational Database Schema & Foreign Key Mapping", h1_style))
    story.append(Paragraph(
        "Complete schema mapping showing how tables connect across multi-tenancy, sales pipeline, "
        "activity tracking, AI analysis, invoicing, and auditing in Supabase PostgreSQL.",
        body_style
    ))
    story.append(Spacer(1, 6))

    schema_headers = ["Source Table", "Target Table", "Foreign Key Column", "Type", "Relationship / Behavior"]
    col_widths_schema = [92, 92, 120, 50, 178]

    def make_section(title, rows):
        elements = [
            Paragraph(title, h2_style),
            Spacer(1, 2)
        ]
        t_data = [[Paragraph(h, th_style) for h in schema_headers]]
        for r in rows:
            t_data.append([
                Paragraph(f"<b>{r[0]}</b>", td_bold),
                Paragraph(f"<b>{r[1]}</b>", td_style),
                Paragraph(f"<code>{r[2]}</code>", td_style),
                Paragraph(r[3], td_style),
                Paragraph(r[4], td_style),
            ])
        t = Table(t_data, colWidths=col_widths_schema, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_BG_ALT]),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 8))
        return elements

    # Group 1: Multi-Tenancy & Identity
    group1 = [
        ["users", "organizations", "organization_id", "N:1", "Tenant boundary isolation (CASCADE)"],
        ["users", "roles", "role_id", "N:1", "RBAC role assignment (SET NULL)"],
        ["users", "users", "manager_id", "N:1", "Self-referencing manager hierarchy (SET NULL)"],
        ["roles", "organizations", "organization_id", "N:1", "Tenant scoped roles (CASCADE)"],
        ["role_permissions", "roles", "role_id", "N:1", "Role to permission link (CASCADE)"],
        ["role_permissions", "permissions", "permission_id", "N:1", "Permission definition link (CASCADE)"],
        ["teams", "organizations", "organization_id", "N:1", "Sales team tenant scoping (CASCADE)"],
        ["teams", "users", "manager_id", "N:1", "Team leader / manager assignment (SET NULL)"],
        ["team_members", "teams", "team_id", "N:1", "Team membership link (CASCADE)"],
        ["team_members", "users", "user_id", "N:1", "Salesperson member link (CASCADE)"],
    ]
    story.extend(make_section("1. Multi-Tenancy, Identity & Governance Layer", group1))

    # Group 2: Leads & Marketing
    group2 = [
        ["leads", "organizations", "organization_id", "N:1", "Tenant scoping boundary (CASCADE)"],
        ["leads", "users", "assigned_to", "N:1", "Assigned salesperson / owner (SET NULL)"],
        ["leads", "campaigns", "campaign_id", "N:1", "Attribution marketing campaign (SET NULL)"],
        ["leads", "products", "product_id", "N:1", "Interested product catalog entry (SET NULL)"],
        ["lead_signals", "leads", "lead_id", "N:1", "AI activity signal event tracking (CASCADE)"],
        ["lead_conversions", "leads", "lead_id", "1:1", "Unique conversion record history (CASCADE)"],
        ["lead_conversions", "accounts", "account_id", "N:1", "Account generated from lead conversion (CASCADE)"],
        ["lead_conversions", "opportunities", "opportunity_id", "N:1", "Deal generated from lead conversion (SET NULL)"],
        ["lead_conversions", "contacts", "contact_id", "N:1", "Contact generated from lead conversion (SET NULL)"],
        ["campaign_members", "campaigns", "campaign_id", "N:1", "Campaign audience target list (CASCADE)"],
        ["campaign_members", "leads", "lead_id", "N:1", "Lead associated with campaign (CASCADE)"],
        ["campaign_members", "contacts", "contact_id", "N:1", "Contact associated with campaign (CASCADE)"],
        ["campaign_responses", "campaign_members", "campaign_member_id", "N:1", "Member interaction / click response (CASCADE)"],
    ]
    story.extend(make_section("2. Leads, Enrichment Signals & Marketing Campaigns", group2))

    # Group 3: Accounts, Contacts & Sales Pipeline
    group3 = [
        ["accounts", "organizations", "organization_id", "N:1", "Tenant boundary isolation (CASCADE)"],
        ["accounts", "users", "owner_id", "N:1", "Account executive / owner (SET NULL)"],
        ["contacts", "organizations", "organization_id", "N:1", "Tenant boundary isolation (CASCADE)"],
        ["contacts", "accounts", "account_id", "N:1", "Company account that contact belongs to (CASCADE)"],
        ["contacts", "users", "owner_id", "N:1", "Contact record owner (SET NULL)"],
        ["deals", "organizations", "organization_id", "N:1", "Tenant boundary isolation (CASCADE)"],
        ["deals", "accounts", "account_id", "N:1", "Primary client account for opportunity (CASCADE)"],
        ["deals", "contacts", "contact_id", "N:1", "Primary decision-maker contact (SET NULL)"],
        ["deals", "users", "owner_id", "N:1", "Deal owner / sales representative (SET NULL)"],
        ["deals", "campaigns", "campaign_id", "N:1", "Source campaign for deal attribution (SET NULL)"],
        ["deal_products", "deals", "deal_id", "N:1", "Deal items line specification (CASCADE)"],
        ["deal_products", "products", "product_id", "N:1", "Catalog product line item (RESTRICT)"],
    ]
    story.extend(make_section("3. Accounts, Contacts & Sales Opportunities (Deals)", group3))

    # Group 4: Activities, Transcripts & AI Analysis
    group4 = [
        ["activities", "organizations", "organization_id", "N:1", "Tenant boundary isolation (CASCADE)"],
        ["activities", "leads", "lead_id", "N:1", "Activity related to unconverted lead (SET NULL)"],
        ["activities", "accounts", "account_id", "N:1", "Activity related to client company (CASCADE)"],
        ["activities", "contacts", "contact_id", "N:1", "Activity related to person contact (CASCADE)"],
        ["activities", "deals", "opportunity_id", "N:1", "Activity related to sales opportunity (CASCADE)"],
        ["activities", "users", "user_id", "N:1", "Salesperson creator / performer (SET NULL)"],
        ["activity_participants", "activities", "activity_id", "N:1", "Meeting / call attendees (CASCADE)"],
        ["activity_participants", "users", "user_id", "N:1", "Internal employee participant (CASCADE)"],
        ["activity_participants", "contacts", "contact_id", "N:1", "External customer participant (CASCADE)"],
        ["call_transcripts", "activities", "activity_id", "1:1", "Call transcript tied strictly 1:1 with Call Activity (CASCADE)"],
        ["call_transcripts", "organizations", "organization_id", "N:1", "Tenant boundary isolation (CASCADE)"],
        ["call_analysis", "call_transcripts", "transcript_id", "N:1", "AI analysis structured outputs (1:N for versioning, CASCADE)"],
        ["call_analysis", "activities", "activity_id", "N:1", "Parent call activity link (SET NULL)"],
        ["call_analysis", "leads", "lead_id", "N:1", "Direct lead association for sentiment analytics (SET NULL)"],
        ["call_analysis", "contacts", "contact_id", "N:1", "Direct contact association (SET NULL)"],
        ["call_analysis", "accounts", "account_id", "N:1", "Direct account association (CASCADE)"],
        ["call_analysis", "users", "analyzed_by", "N:1", "Sales representative / analyst identity (SET NULL)"],
        ["notes", "organizations", "organization_id", "N:1", "Tenant boundary isolation (CASCADE)"],
        ["notes", "users", "user_id", "N:1", "Note author / salesperson (SET NULL)"],
    ]
    story.extend(make_section("4. Activities, Call Transcripts & AI Intelligence Layer", group4))

    # Group 5: Performance, Invoices, Docs & Auditing
    group5 = [
        ["sales_targets", "organizations", "organization_id", "N:1", "Tenant boundary isolation (CASCADE)"],
        ["sales_targets", "users", "assigned_to_user_id", "N:1", "Salesperson holding quota target (CASCADE)"],
        ["sales_targets", "users", "assigned_by_user_id", "N:1", "Manager or Owner who set target (RESTRICT)"],
        ["sales_targets", "teams", "team_id", "N:1", "Associated sales team quota (CASCADE)"],
        ["invoices", "accounts", "account_id", "N:1", "Billed enterprise account (CASCADE)"],
        ["invoices", "deals", "deal_id", "N:1", "Deal associated with invoice (SET NULL)"],
        ["invoice_items", "invoices", "invoice_id", "N:1", "Line item within invoice (CASCADE)"],
        ["invoice_items", "products", "product_id", "N:1", "Catalog product line item (SET NULL)"],
        ["payments", "invoices", "invoice_id", "N:1", "Received payment transaction (CASCADE)"],
        ["documents", "users", "uploaded_by", "N:1", "File uploader identity (SET NULL)"],
        ["document_relations", "documents", "document_id", "N:1", "Document attachment to lead/deal/account (CASCADE)"],
        ["document_versions", "documents", "document_id", "N:1", "File versioning history (CASCADE)"],
        ["audit_logs", "organizations", "organization_id", "N:1", "Tenant boundary isolation (CASCADE)"],
        ["audit_logs", "users", "user_id", "N:1", "Actor who performed the CRM operation (SET NULL)"],
    ]
    story.extend(make_section("5. Sales Targets, Invoices, Documents & Audit Trails", group5))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated at: {output_path}")


if __name__ == "__main__":
    out_file = os.path.abspath("docs/Dakini_CRM_RBAC_and_Database_Architecture_Report.pdf")
    build_pdf(out_file)
