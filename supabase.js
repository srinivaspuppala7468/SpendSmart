// SpendSmart Supabase connection

const SUPABASE_URL = "https://pcmzabmlplbsoyhuefdb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yUmu_zSpx1l76iwV1Sg_Cw_YSuKi410";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);