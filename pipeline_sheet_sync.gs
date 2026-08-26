// YAAS CRM -> Pipeline Sheet Sync
//
// SETUP:
// 1. Extensions > Apps Script in the Pipeline Sheet
// 2. Paste this file (replace all existing code)
// 3. Project Settings (gear icon) > Script Properties > Add:
//      SUPABASE_URL  = https://ncydzbyvhiyczbgvclex.supabase.co
//      SUPABASE_KEY  = <your service role key>
// 4. Run syncPipeline() once to approve permissions
// 5. Triggers (clock icon) > Add Trigger:
//      Function: syncPipeline, Time-driven, Minutes timer, Every minute
//
// OPTIONAL real-time webhook:
// 6. Deploy > New deployment > Web app (Execute as: Me, Access: Anyone)
//    Copy the URL.
// 7. Supabase Dashboard > Database > Webhooks > Create:
//    Table: deals, Events: INSERT + UPDATE, POST to the URL above.

var ELIGIBLE_STAGES = [
  "email_confirmation",
  "legal",
  "contract_signed",
  "handed_to_content_ops",
  "live",
  "paused"
];

var STAGE_LABELS = {
  email_confirmation:     "Email Confirmation",
  legal:                  "Legal",
  contract_signed:        "Contract Signed",
  handed_to_content_ops:  "Handed to Content Ops",
  live:                   "Live",
  paused:                 "Paused"
};

var SERVICE_LABELS = {
  e2e_surrogate:        "E2E - Surrogate",
  e2e_branded:          "E2E - Branded",
  influencer_marketing: "Influencer Marketing",
  podcast_production:   "Podcast Production",
  one_time_project:     "One-time Project",
  e2e_founder_led:      "E2E - Founder-led",
  ai_videos:            "AI Videos"
};

var SOURCE_LABELS = {
  yaas_form:     "YAAS form",
  referral:      "Referral",
  outbound:      "Outbound",
  inbound_email: "Inbound email",
  linkedin:      "LinkedIn",
  event:         "Event",
  other:         "Other"
};

function syncPipeline() {
  var props = PropertiesService.getScriptProperties();
  var SUPABASE_URL = props.getProperty("SUPABASE_URL");
  var SUPABASE_KEY = props.getProperty("SUPABASE_KEY");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Set SUPABASE_URL and SUPABASE_KEY in Script Properties first.");
  }

  var stageList = ELIGIBLE_STAGES.join(",");

  // Fetch deals in eligible stages
  var deals = sbFetch(SUPABASE_URL, SUPABASE_KEY,
    "/rest/v1/deals" +
    "?select=id,lead_id,stage,value_mrr,value_one_time,expected_close_date,owner_id" +
    "&stage=in.(" + stageList + ")" +
    "&order=updated_at.desc"
  );

  if (!deals || deals.length === 0) {
    clearRows();
    Logger.log("No eligible deals.");
    return;
  }

  var leadIds = deals.map(function(d) { return d.lead_id; }).filter(Boolean).join(",");

  // Fetch leads
  var leads = sbFetch(SUPABASE_URL, SUPABASE_KEY,
    "/rest/v1/leads" +
    "?select=id,name,email,phone,source,service_type,additional_info,company_id" +
    "&id=in.(" + leadIds + ")"
  );

  // Fetch companies
  var companyIds = (leads || [])
    .filter(function(l) { return l.company_id; })
    .map(function(l) { return l.company_id; })
    .join(",");

  var companies = companyIds
    ? sbFetch(SUPABASE_URL, SUPABASE_KEY,
        "/rest/v1/companies?select=id,name,industry&id=in.(" + companyIds + ")")
    : [];

  // Fetch onboardings
  var onboardings = sbFetch(SUPABASE_URL, SUPABASE_KEY,
    "/rest/v1/onboardings" +
    "?select=lead_id,final_scope_of_work,format,go_live_timeline,poc_name,email,whatsapp_number,team_required,operationalised,briefing_doc_url,daily_notes" +
    "&lead_id=in.(" + leadIds + ")"
  );

  // Build lookup maps
  var leadMap = {};
  (leads || []).forEach(function(l) { leadMap[l.id] = l; });

  var companyMap = {};
  (companies || []).forEach(function(c) { companyMap[c.id] = c; });

  var obMap = {};
  (onboardings || []).forEach(function(o) { obMap[o.lead_id] = o; });

  // Build rows
  var rows = deals.map(function(deal) {
    var lead    = leadMap[deal.lead_id]                   || {};
    var company = lead.company_id ? companyMap[lead.company_id] || {} : {};
    var ob      = obMap[deal.lead_id]                     || {};

    var serviceId    = lead.service_type || "";
    var serviceLabel = SERVICE_LABELS[serviceId] || serviceId;
    var sourceLabel  = SOURCE_LABELS[lead.source] || lead.source || "";
    var brandName    = company.name || lead.name || "";
    var stageLabel   = STAGE_LABELS[deal.stage]  || deal.stage  || "";

    var ipType = "";
    if (serviceId === "e2e_surrogate")   { ipType = "Surrogate"; }
    else if (serviceId === "e2e_branded")     { ipType = "Branded"; }
    else if (serviceId === "e2e_founder_led") { ipType = "Founder-led"; }
    else if (serviceId)                       { ipType = "Other"; }

    var projectType = (deal.value_mrr && deal.value_mrr > 0) ? "Retainer" : "One-time";
    var timeline    = ob.go_live_timeline || deal.expected_close_date || "";

    return [
      sourceLabel,
      serviceLabel,
      brandName,
      ipType,
      company.industry || "",
      stageLabel,
      projectType,
      ob.format || "",
      ob.final_scope_of_work || "",
      ob.briefing_doc_url || "",
      timeline,
      ob.poc_name || lead.name || "",
      lead.email  || ob.email  || "",
      lead.phone  || ob.whatsapp_number || "",
      ob.daily_notes || lead.additional_info || "",
      ob.operationalised ? "Yes" : "No",
      ob.team_required || ""
    ];
  });

  // Write to sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  clearRows();
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 17).setValues(rows);
  }

  Logger.log("Synced " + rows.length + " rows at " + new Date().toLocaleTimeString());
}

function doPost(e) {
  try {
    syncPipeline();
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("doPost error: " + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sbFetch(url, key, path) {
  var resp = UrlFetchApp.fetch(url + path, {
    headers: {
      "apikey":        key,
      "Authorization": "Bearer " + key,
      "Content-Type":  "application/json"
    },
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  var body = resp.getContentText();
  if (code !== 200) {
    Logger.log("Supabase error " + code + ": " + body);
    return [];
  }
  return JSON.parse(body);
}

function clearRows() {
  var sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 17).clearContent();
  }
}
