package districts

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"backend/internal/database"
)

type DistrictRecord struct {
	ID        string
	Name      string
	Code      string
	State     string
	CreatedAt sql.NullTime
}

type TalukRecord struct {
	ID         string
	DistrictID string
	Name       string
	Type       string
	Code       sql.NullString
	CreatedAt  sql.NullTime
}

type Repository interface {
	GetDistricts(ctx context.Context) ([]*DistrictRecord, error)
	GetTaluksByDistrict(ctx context.Context, districtID string) ([]*TalukRecord, error)
	GetDistrictByID(ctx context.Context, id string) (*DistrictRecord, error)
	GetTalukByID(ctx context.Context, id string) (*TalukRecord, error)
	GetDepartmentCodeByID(ctx context.Context, id string) (code string, name string, err error)
	CreateOfficerAccount(ctx context.Context, name, email, officialEmail, passHash, designation, deptID, districtID, talukID string) (string, error)
}

type postgresRepo struct {
	db *database.DB
}

func NewRepository(db *database.DB) Repository {
	return &postgresRepo{db: db}
}

var fallbackDistricts = []*DistrictRecord{
	{ID: "dist-bgk-017", Name: "Bagalkot", Code: "BGK", State: "Karnataka"},
	{ID: "dist-bal-009", Name: "Ballari", Code: "BAL", State: "Karnataka"},
	{ID: "dist-bgm-005", Name: "Belagavi", Code: "BGM", State: "Karnataka"},
	{ID: "dist-blrr-002", Name: "Bengaluru Rural", Code: "BLRR", State: "Karnataka"},
	{ID: "dist-blru-001", Name: "Bengaluru Urban", Code: "BLRU", State: "Karnataka"},
	{ID: "dist-bdr-018", Name: "Bidar", Code: "BDR", State: "Karnataka"},
	{ID: "dist-cmr-019", Name: "Chamarajanagar", Code: "CMR", State: "Karnataka"},
	{ID: "dist-cbp-015", Name: "Chikkaballapur", Code: "CBP", State: "Karnataka"},
	{ID: "dist-ckm-016", Name: "Chikkamagaluru", Code: "CKM", State: "Karnataka"},
	{ID: "dist-cta-020", Name: "Chitradurga", Code: "CTA", State: "Karnataka"},
	{ID: "dist-dk-004", Name: "Dakshina Kannada", Code: "DK", State: "Karnataka"},
	{ID: "dist-dvg-021", Name: "Davanagere", Code: "DVG", State: "Karnataka"},
	{ID: "dist-dwd-006", Name: "Dharwad", Code: "DWD", State: "Karnataka"},
	{ID: "dist-gdg-022", Name: "Gadag", Code: "GDG", State: "Karnataka"},
	{ID: "dist-hsn-012", Name: "Hassan", Code: "HSN", State: "Karnataka"},
	{ID: "dist-hvr-023", Name: "Haveri", Code: "HVR", State: "Karnataka"},
	{ID: "dist-klb-007", Name: "Kalaburagi", Code: "KLB", State: "Karnataka"},
	{ID: "dist-kdg-024", Name: "Kodagu", Code: "KDG", State: "Karnataka"},
	{ID: "dist-klr-025", Name: "Kolar", Code: "KLR", State: "Karnataka"},
	{ID: "dist-kpl-026", Name: "Koppal", Code: "KPL", State: "Karnataka"},
	{ID: "dist-mnd-013", Name: "Mandya", Code: "MND", State: "Karnataka"},
	{ID: "dist-mys-003", Name: "Mysuru", Code: "MYS", State: "Karnataka"},
	{ID: "dist-rcr-027", Name: "Raichur", Code: "RCR", State: "Karnataka"},
	{ID: "dist-rmng-014", Name: "Ramanagara", Code: "RMNG", State: "Karnataka"},
	{ID: "dist-smg-010", Name: "Shivamogga", Code: "SMG", State: "Karnataka"},
	{ID: "dist-tmk-008", Name: "Tumakuru", Code: "TMK", State: "Karnataka"},
	{ID: "dist-udp-011", Name: "Udupi", Code: "UDP", State: "Karnataka"},
	{ID: "dist-uk-028", Name: "Uttara Kannada", Code: "UK", State: "Karnataka"},
	{ID: "dist-vjn-029", Name: "Vijayanagara", Code: "VJN", State: "Karnataka"},
	{ID: "dist-vjp-030", Name: "Vijayapura", Code: "VJP", State: "Karnataka"},
	{ID: "dist-ydg-031", Name: "Yadgir", Code: "YDG", State: "Karnataka"},
}

func ns(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

var fallbackTaluks = map[string][]*TalukRecord{
	"Bengaluru Urban": {
		{ID: "tlk-ylk-001", DistrictID: "dist-blru-001", Name: "Yelahanka Taluk (BBMP North)", Type: "Municipal_Corporation", Code: ns("YLK")},
		{ID: "tlk-blrs-002", DistrictID: "dist-blru-001", Name: "Bangalore South (BBMP South)", Type: "Municipal_Corporation", Code: ns("BLRS")},
		{ID: "tlk-blre-003", DistrictID: "dist-blru-001", Name: "Bangalore East (BBMP East)", Type: "Municipal_Corporation", Code: ns("BLRE")},
		{ID: "tlk-blrw-004", DistrictID: "dist-blru-001", Name: "Bangalore West (BBMP West)", Type: "Municipal_Corporation", Code: ns("BLRW")},
		{ID: "tlk-ank-005", DistrictID: "dist-blru-001", Name: "Anekal Taluk", Type: "Taluk", Code: ns("ANK")},
	},
	"Bengaluru Rural": {
		{ID: "tlk-dvh-006", DistrictID: "dist-blrr-002", Name: "Devanahalli Taluk", Type: "Taluk", Code: ns("DVH")},
		{ID: "tlk-nlm-007", DistrictID: "dist-blrr-002", Name: "Nelamangala Taluk", Type: "Taluk", Code: ns("NLM")},
		{ID: "tlk-dbp-008", DistrictID: "dist-blrr-002", Name: "Doddaballapura Taluk", Type: "Taluk", Code: ns("DBP")},
		{ID: "tlk-hsk-009", DistrictID: "dist-blrr-002", Name: "Hoskote Taluk", Type: "Taluk", Code: ns("HSK")},
	},
	"Mysuru": {
		{ID: "tlk-mcc-010", DistrictID: "dist-mys-003", Name: "Mysuru City Corporation (MCC)", Type: "Municipal_Corporation", Code: ns("MCC")},
		{ID: "tlk-hns-011", DistrictID: "dist-mys-003", Name: "Hunsur Taluk", Type: "Taluk", Code: ns("HNS")},
		{ID: "tlk-njg-012", DistrictID: "dist-mys-003", Name: "Nanjangud Taluk", Type: "Taluk", Code: ns("NJG")},
		{ID: "tlk-tnp-013", DistrictID: "dist-mys-003", Name: "T.Narasipura Taluk", Type: "Taluk", Code: ns("TNP")},
		{ID: "tlk-ppt-014", DistrictID: "dist-mys-003", Name: "Periyapatna Taluk", Type: "Taluk", Code: ns("PPT")},
		{ID: "tlk-krn-015", DistrictID: "dist-mys-003", Name: "K.R. Nagar Taluk", Type: "Taluk", Code: ns("KRN")},
	},
	"Dakshina Kannada": {
		{ID: "tlk-mng-016", DistrictID: "dist-dk-004", Name: "Mangaluru City Corporation", Type: "Municipal_Corporation", Code: ns("MNG")},
		{ID: "tlk-btw-017", DistrictID: "dist-dk-004", Name: "Bantwal Taluk", Type: "Taluk", Code: ns("BTW")},
		{ID: "tlk-ptr-018", DistrictID: "dist-dk-004", Name: "Puttur Taluk", Type: "Taluk", Code: ns("PTR")},
		{ID: "tlk-sla-019", DistrictID: "dist-dk-004", Name: "Sullia Taluk", Type: "Taluk", Code: ns("SLA")},
		{ID: "tlk-blt-020", DistrictID: "dist-dk-004", Name: "Belthangady Taluk", Type: "Taluk", Code: ns("BLT")},
	},
	"Belagavi": {
		{ID: "tlk-bgc-021", DistrictID: "dist-bgm-005", Name: "Belagavi City Corporation", Type: "Municipal_Corporation", Code: ns("BGC")},
		{ID: "tlk-ckd-022", DistrictID: "dist-bgm-005", Name: "Chikkodi Taluk", Type: "Taluk", Code: ns("CKD")},
		{ID: "tlk-gkk-023", DistrictID: "dist-bgm-005", Name: "Gokak Taluk", Type: "Taluk", Code: ns("GKK")},
		{ID: "tlk-knp-024", DistrictID: "dist-bgm-005", Name: "Khanapur Taluk", Type: "Taluk", Code: ns("KNP")},
		{ID: "tlk-athl-025", DistrictID: "dist-bgm-005", Name: "Athani Taluk", Type: "Taluk", Code: ns("ATN")},
		{ID: "tlk-bhl-026", DistrictID: "dist-bgm-005", Name: "Bailhongal Taluk", Type: "Taluk", Code: ns("BHL")},
	},
	"Dharwad": {
		{ID: "tlk-hdmc-027", DistrictID: "dist-dwd-006", Name: "Hubballi-Dharwad Corporation (HDMC)", Type: "Municipal_Corporation", Code: ns("HDMC")},
		{ID: "tlk-kgt-028", DistrictID: "dist-dwd-006", Name: "Kalghatgi Taluk", Type: "Taluk", Code: ns("KGT")},
		{ID: "tlk-kdl-029", DistrictID: "dist-dwd-006", Name: "Kundgol Taluk", Type: "Taluk", Code: ns("KDL")},
		{ID: "tlk-nvg-030", DistrictID: "dist-dwd-006", Name: "Navalgund Taluk", Type: "Taluk", Code: ns("NVG")},
	},
	"Kalaburagi": {
		{ID: "tlk-kbc-031", DistrictID: "dist-klb-007", Name: "Kalaburagi City Corporation", Type: "Municipal_Corporation", Code: ns("KBC")},
		{ID: "tlk-ald-032", DistrictID: "dist-klb-007", Name: "Aland Taluk", Type: "Taluk", Code: ns("ALD")},
		{ID: "tlk-sdm-033", DistrictID: "dist-klb-007", Name: "Sedam Taluk", Type: "Taluk", Code: ns("SDM")},
		{ID: "tlk-afz-034", DistrictID: "dist-klb-007", Name: "Afzalpur Taluk", Type: "Taluk", Code: ns("AFZ")},
		{ID: "tlk-ctp-035", DistrictID: "dist-klb-007", Name: "Chittapur Taluk", Type: "Taluk", Code: ns("CTP")},
	},
	"Tumakuru": {
		{ID: "tlk-tkc-036", DistrictID: "dist-tmk-008", Name: "Tumakuru City Corporation", Type: "Municipal_Corporation", Code: ns("TKC")},
		{ID: "tlk-gbi-037", DistrictID: "dist-tmk-008", Name: "Gubbi Taluk", Type: "Taluk", Code: ns("GBI")},
		{ID: "tlk-kgl-038", DistrictID: "dist-tmk-008", Name: "Kunigal Taluk", Type: "Taluk", Code: ns("KGL")},
		{ID: "tlk-tpr-039", DistrictID: "dist-tmk-008", Name: "Tiptur Taluk", Type: "Taluk", Code: ns("TPR")},
		{ID: "tlk-sra-040", DistrictID: "dist-tmk-008", Name: "Sira Taluk", Type: "Taluk", Code: ns("SRA")},
		{ID: "tlk-mdg-041", DistrictID: "dist-tmk-008", Name: "Madhugiri Taluk", Type: "Taluk", Code: ns("MDG")},
	},
	"Ballari": {
		{ID: "tlk-blc-042", DistrictID: "dist-bal-009", Name: "Ballari City Corporation", Type: "Municipal_Corporation", Code: ns("BLC")},
		{ID: "tlk-sgp-043", DistrictID: "dist-bal-009", Name: "Siruguppa Taluk", Type: "Taluk", Code: ns("SGP")},
		{ID: "tlk-kgd-044", DistrictID: "dist-bal-009", Name: "Kurugodu Taluk", Type: "Taluk", Code: ns("KGD")},
		{ID: "tlk-snd-045", DistrictID: "dist-bal-009", Name: "Sandur Taluk", Type: "Taluk", Code: ns("SND")},
	},
	"Shivamogga": {
		{ID: "tlk-smc-046", DistrictID: "dist-smg-010", Name: "Shivamogga City Corporation", Type: "Municipal_Corporation", Code: ns("SMC")},
		{ID: "tlk-bdv-047", DistrictID: "dist-smg-010", Name: "Bhadravathi Taluk", Type: "Taluk", Code: ns("BDV")},
		{ID: "tlk-sgr-048", DistrictID: "dist-smg-010", Name: "Sagar Taluk", Type: "Taluk", Code: ns("SGR")},
		{ID: "tlk-skr-049", DistrictID: "dist-smg-010", Name: "Shikaripura Taluk", Type: "Taluk", Code: ns("SKR")},
		{ID: "tlk-tht-050", DistrictID: "dist-smg-010", Name: "Thirthahalli Taluk", Type: "Taluk", Code: ns("THT")},
	},
	"Udupi": {
		{ID: "tlk-udc-051", DistrictID: "dist-udp-011", Name: "Udupi City Municipal Council", Type: "CMC", Code: ns("UDC")},
		{ID: "tlk-kdp-052", DistrictID: "dist-udp-011", Name: "Kundapura Taluk", Type: "Taluk", Code: ns("KDP")},
		{ID: "tlk-kkl-053", DistrictID: "dist-udp-011", Name: "Karkala Taluk", Type: "Taluk", Code: ns("KKL")},
		{ID: "tlk-kup-054", DistrictID: "dist-udp-011", Name: "Kaup Taluk", Type: "Taluk", Code: ns("KUP")},
		{ID: "tlk-bmv-055", DistrictID: "dist-udp-011", Name: "Brahmavara Taluk", Type: "Taluk", Code: ns("BMV")},
	},
	"Hassan": {
		{ID: "tlk-hnc-056", DistrictID: "dist-hsn-012", Name: "Hassan City Municipal Council", Type: "CMC", Code: ns("HNC")},
		{ID: "tlk-ask-057", DistrictID: "dist-hsn-012", Name: "Arsikere Taluk", Type: "Taluk", Code: ns("ASK")},
		{ID: "tlk-crp-058", DistrictID: "dist-hsn-012", Name: "Channarayapatna Taluk", Type: "Taluk", Code: ns("CRP")},
		{ID: "tlk-skp-059", DistrictID: "dist-hsn-012", Name: "Sakleshpur Taluk", Type: "Taluk", Code: ns("SKP")},
		{ID: "tlk-blr-060", DistrictID: "dist-hsn-012", Name: "Belur Taluk", Type: "Taluk", Code: ns("BLR")},
	},
	"Mandya": {
		{ID: "tlk-mnc-061", DistrictID: "dist-mnd-013", Name: "Mandya City Municipal Council", Type: "CMC", Code: ns("MNC")},
		{ID: "tlk-mdr-062", DistrictID: "dist-mnd-013", Name: "Maddur Taluk", Type: "Taluk", Code: ns("MDR")},
		{ID: "tlk-srp-063", DistrictID: "dist-mnd-013", Name: "Srirangapatna Taluk", Type: "Taluk", Code: ns("SRP")},
		{ID: "tlk-mlv-064", DistrictID: "dist-mnd-013", Name: "Malavalli Taluk", Type: "Taluk", Code: ns("MLV")},
		{ID: "tlk-pdp-065", DistrictID: "dist-mnd-013", Name: "Pandavapura Taluk", Type: "Taluk", Code: ns("PDP")},
	},
	"Ramanagara": {
		{ID: "tlk-rmc-066", DistrictID: "dist-rmng-014", Name: "Ramanagara City Municipal Council", Type: "CMC", Code: ns("RMC")},
		{ID: "tlk-cpn-067", DistrictID: "dist-rmng-014", Name: "Channapatna Taluk", Type: "Taluk", Code: ns("CPN")},
		{ID: "tlk-kkp-068", DistrictID: "dist-rmng-014", Name: "Kanakapura Taluk", Type: "Taluk", Code: ns("KKP")},
		{ID: "tlk-mgd-069", DistrictID: "dist-rmng-014", Name: "Magadi Taluk", Type: "Taluk", Code: ns("MGD")},
	},
	"Chikkaballapur": {
		{ID: "tlk-cbc-070", DistrictID: "dist-cbp-015", Name: "Chikkaballapur City Municipal Council", Type: "CMC", Code: ns("CBC")},
		{ID: "tlk-gbn-071", DistrictID: "dist-cbp-015", Name: "Gauribidanur Taluk", Type: "Taluk", Code: ns("GBN")},
		{ID: "tlk-bgp-072", DistrictID: "dist-cbp-015", Name: "Bagepalli Taluk", Type: "Taluk", Code: ns("BGP")},
		{ID: "tlk-cnt-073", DistrictID: "dist-cbp-015", Name: "Chintamani Taluk", Type: "Taluk", Code: ns("CNT")},
		{ID: "tlk-sdl-074", DistrictID: "dist-cbp-015", Name: "Sidlaghatta Taluk", Type: "Taluk", Code: ns("SDL")},
	},
	"Chikkamagaluru": {
		{ID: "tlk-ckmc-075", DistrictID: "dist-ckm-016", Name: "Chikkamagaluru City Municipal Council", Type: "CMC", Code: ns("CKMC")},
		{ID: "tlk-kdr-076", DistrictID: "dist-ckm-016", Name: "Kadur Taluk", Type: "Taluk", Code: ns("KDR")},
		{ID: "tlk-kpa-077", DistrictID: "dist-ckm-016", Name: "Koppa Taluk", Type: "Taluk", Code: ns("KPA")},
		{ID: "tlk-mdg-078", DistrictID: "dist-ckm-016", Name: "Mudigere Taluk", Type: "Taluk", Code: ns("MDG")},
		{ID: "tlk-trk-079", DistrictID: "dist-ckm-016", Name: "Tarikere Taluk", Type: "Taluk", Code: ns("TRK")},
		{ID: "tlk-srg-080", DistrictID: "dist-ckm-016", Name: "Sringeri Taluk", Type: "Taluk", Code: ns("SRG")},
	},
	"Bagalkot": {
		{ID: "tlk-bkc-081", DistrictID: "dist-bgk-017", Name: "Bagalkot City Municipal Council", Type: "CMC", Code: ns("BKC")},
		{ID: "tlk-bdm-082", DistrictID: "dist-bgk-017", Name: "Badami Taluk", Type: "Taluk", Code: ns("BDM")},
		{ID: "tlk-jmk-083", DistrictID: "dist-bgk-017", Name: "Jamkhandi Taluk", Type: "Taluk", Code: ns("JMK")},
		{ID: "tlk-mdh-084", DistrictID: "dist-bgk-017", Name: "Mudhol Taluk", Type: "Taluk", Code: ns("MDH")},
		{ID: "tlk-hng-085", DistrictID: "dist-bgk-017", Name: "Hunagund Taluk", Type: "Taluk", Code: ns("HNG")},
	},
	"Bidar": {
		{ID: "tlk-bdc-086", DistrictID: "dist-bdr-018", Name: "Bidar City Municipal Council", Type: "CMC", Code: ns("BDC")},
		{ID: "tlk-bsk-087", DistrictID: "dist-bdr-018", Name: "Basavakalyan Taluk", Type: "Taluk", Code: ns("BSK")},
		{ID: "tlk-blk-088", DistrictID: "dist-bdr-018", Name: "Bhalki Taluk", Type: "Taluk", Code: ns("BLK")},
		{ID: "tlk-hnb-089", DistrictID: "dist-bdr-018", Name: "Humnabad Taluk", Type: "Taluk", Code: ns("HNB")},
	},
	"Chamarajanagar": {
		{ID: "tlk-cmc-090", DistrictID: "dist-cmr-019", Name: "Chamarajanagar City Municipal Council", Type: "CMC", Code: ns("CMC")},
		{ID: "tlk-glp-091", DistrictID: "dist-cmr-019", Name: "Gundlupete Taluk", Type: "Taluk", Code: ns("GLP")},
		{ID: "tlk-klg-092", DistrictID: "dist-cmr-019", Name: "Kollegala Taluk", Type: "Taluk", Code: ns("KLG")},
		{ID: "tlk-hnr-093", DistrictID: "dist-cmr-019", Name: "Hanur Taluk", Type: "Taluk", Code: ns("HNR")},
	},
	"Chitradurga": {
		{ID: "tlk-ctc-094", DistrictID: "dist-cta-020", Name: "Chitradurga City Municipal Council", Type: "CMC", Code: ns("CTC")},
		{ID: "tlk-clk-095", DistrictID: "dist-cta-020", Name: "Challakere Taluk", Type: "Taluk", Code: ns("CLK")},
		{ID: "tlk-hry-096", DistrictID: "dist-cta-020", Name: "Hiriyur Taluk", Type: "Taluk", Code: ns("HRY")},
		{ID: "tlk-hlk-097", DistrictID: "dist-cta-020", Name: "Holalkere Taluk", Type: "Taluk", Code: ns("HLK")},
		{ID: "tlk-hsd-098", DistrictID: "dist-cta-020", Name: "Hosadurga Taluk", Type: "Taluk", Code: ns("HSD")},
	},
	"Davanagere": {
		{ID: "tlk-dvc-099", DistrictID: "dist-dvg-021", Name: "Davanagere City Corporation", Type: "Municipal_Corporation", Code: ns("DVC")},
		{ID: "tlk-hrh-100", DistrictID: "dist-dvg-021", Name: "Harihar Taluk", Type: "Taluk", Code: ns("HRH")},
		{ID: "tlk-cng-101", DistrictID: "dist-dvg-021", Name: "Channagiri Taluk", Type: "Taluk", Code: ns("CNG")},
		{ID: "tlk-hnl-102", DistrictID: "dist-dvg-021", Name: "Honnali Taluk", Type: "Taluk", Code: ns("HNL")},
	},
	"Gadag": {
		{ID: "tlk-gdc-103", DistrictID: "dist-gdg-022", Name: "Gadag-Betageri City Municipal Council", Type: "CMC", Code: ns("GDC")},
		{ID: "tlk-srh-104", DistrictID: "dist-gdg-022", Name: "Shirhatti Taluk", Type: "Taluk", Code: ns("SRH")},
		{ID: "tlk-gjg-105", DistrictID: "dist-gdg-022", Name: "Gajendragad Taluk", Type: "Taluk", Code: ns("GJG")},
		{ID: "tlk-lks-106", DistrictID: "dist-gdg-022", Name: "Lakshmeshwar Taluk", Type: "Taluk", Code: ns("LKS")},
		{ID: "tlk-mdr-107", DistrictID: "dist-gdg-022", Name: "Mundargi Taluk", Type: "Taluk", Code: ns("MDR")},
	},
	"Haveri": {
		{ID: "tlk-hvc-108", DistrictID: "dist-hvr-023", Name: "Haveri City Municipal Council", Type: "CMC", Code: ns("HVC")},
		{ID: "tlk-rnr-109", DistrictID: "dist-hvr-023", Name: "Ranebennur Taluk", Type: "Taluk", Code: ns("RNR")},
		{ID: "tlk-bdg-110", DistrictID: "dist-hvr-023", Name: "Byadgi Taluk", Type: "Taluk", Code: ns("BDG")},
		{ID: "tlk-hgl-111", DistrictID: "dist-hvr-023", Name: "Hangal Taluk", Type: "Taluk", Code: ns("HGL")},
		{ID: "tlk-sga-112", DistrictID: "dist-hvr-023", Name: "Shiggaon Taluk", Type: "Taluk", Code: ns("SGA")},
	},
	"Kodagu": {
		{ID: "tlk-mdk-113", DistrictID: "dist-kdg-024", Name: "Madikeri City Municipal Council", Type: "CMC", Code: ns("MDK")},
		{ID: "tlk-swp-114", DistrictID: "dist-kdg-024", Name: "Somwarpet Taluk", Type: "Taluk", Code: ns("SWP")},
		{ID: "tlk-vjp-115", DistrictID: "dist-kdg-024", Name: "Virajpet Taluk", Type: "Taluk", Code: ns("VJP")},
		{ID: "tlk-ksn-116", DistrictID: "dist-kdg-024", Name: "Kushalnagar Taluk", Type: "Taluk", Code: ns("KSN")},
	},
	"Kolar": {
		{ID: "tlk-klc-117", DistrictID: "dist-klr-025", Name: "Kolar City Municipal Council", Type: "CMC", Code: ns("KLC")},
		{ID: "tlk-bgp-118", DistrictID: "dist-klr-025", Name: "Bangarapet Taluk", Type: "Taluk", Code: ns("BGP")},
		{ID: "tlk-mlr-119", DistrictID: "dist-klr-025", Name: "Malur Taluk", Type: "Taluk", Code: ns("MLR")},
		{ID: "tlk-mbg-120", DistrictID: "dist-klr-025", Name: "Mulbagal Taluk", Type: "Taluk", Code: ns("MBG")},
		{ID: "tlk-kgf-121", DistrictID: "dist-klr-025", Name: "Robertsonpet / KGF", Type: "CMC", Code: ns("KGF")},
	},
	"Koppal": {
		{ID: "tlk-kpc-122", DistrictID: "dist-kpl-026", Name: "Koppal City Municipal Council", Type: "CMC", Code: ns("KPC")},
		{ID: "tlk-ggv-123", DistrictID: "dist-kpl-026", Name: "Gangavathi Taluk", Type: "Taluk", Code: ns("GGV")},
		{ID: "tlk-kst-124", DistrictID: "dist-kpl-026", Name: "Kushtagi Taluk", Type: "Taluk", Code: ns("KST")},
		{ID: "tlk-ylb-125", DistrictID: "dist-kpl-026", Name: "Yelburga Taluk", Type: "Taluk", Code: ns("YLB")},
	},
	"Raichur": {
		{ID: "tlk-rcc-126", DistrictID: "dist-rcr-027", Name: "Raichur City Municipal Council", Type: "CMC", Code: ns("RCC")},
		{ID: "tlk-sdn-127", DistrictID: "dist-rcr-027", Name: "Sindhanur Taluk", Type: "Taluk", Code: ns("SDN")},
		{ID: "tlk-mnv-128", DistrictID: "dist-rcr-027", Name: "Manvi Taluk", Type: "Taluk", Code: ns("MNV")},
		{ID: "tlk-lng-129", DistrictID: "dist-rcr-027", Name: "Lingsugur Taluk", Type: "Taluk", Code: ns("LNG")},
		{ID: "tlk-dvd-130", DistrictID: "dist-rcr-027", Name: "Deva Durga Taluk", Type: "Taluk", Code: ns("DVD")},
	},
	"Uttara Kannada": {
		{ID: "tlk-kwc-131", DistrictID: "dist-uk-028", Name: "Karwar City Municipal Council", Type: "CMC", Code: ns("KWC")},
		{ID: "tlk-srs-132", DistrictID: "dist-uk-028", Name: "Sirsi Taluk", Type: "Taluk", Code: ns("SRS")},
		{ID: "tlk-btk-133", DistrictID: "dist-uk-028", Name: "Bhatkal Taluk", Type: "Taluk", Code: ns("BTK")},
		{ID: "tlk-kmt-134", DistrictID: "dist-uk-028", Name: "Kumta Taluk", Type: "Taluk", Code: ns("KMT")},
		{ID: "tlk-hnv-135", DistrictID: "dist-uk-028", Name: "Honnavar Taluk", Type: "Taluk", Code: ns("HNV")},
		{ID: "tlk-dnd-136", DistrictID: "dist-uk-028", Name: "Dandeli Taluk", Type: "CMC", Code: ns("DND")},
	},
	"Vijayanagara": {
		{ID: "tlk-hpc-137", DistrictID: "dist-vjn-029", Name: "Hosapete City Municipal Council", Type: "CMC", Code: ns("HPC")},
		{ID: "tlk-kdlg-138", DistrictID: "dist-vjn-029", Name: "Kudligi Taluk", Type: "Taluk", Code: ns("KDLG")},
		{ID: "tlk-hrp-139", DistrictID: "dist-vjn-029", Name: "Harapanahalli Taluk", Type: "Taluk", Code: ns("HRP")},
		{ID: "tlk-hgb-140", DistrictID: "dist-vjn-029", Name: "Hagaribommanahalli Taluk", Type: "Taluk", Code: ns("HGB")},
	},
	"Vijayapura": {
		{ID: "tlk-vjc-141", DistrictID: "dist-vjp-030", Name: "Vijayapura City Corporation", Type: "Municipal_Corporation", Code: ns("VJC")},
		{ID: "tlk-ind-142", DistrictID: "dist-vjp-030", Name: "Indi Taluk", Type: "Taluk", Code: ns("IND")},
		{ID: "tlk-mdb-143", DistrictID: "dist-vjp-030", Name: "Muddebihal Taluk", Type: "Taluk", Code: ns("MDB")},
		{ID: "tlk-sdg-144", DistrictID: "dist-vjp-030", Name: "Sindagi Taluk", Type: "Taluk", Code: ns("SDG")},
		{ID: "tlk-bgb-145", DistrictID: "dist-vjp-030", Name: "Basavana Bagewadi Taluk", Type: "Taluk", Code: ns("BGB")},
	},
	"Yadgir": {
		{ID: "tlk-ydc-146", DistrictID: "dist-ydg-031", Name: "Yadgir City Municipal Council", Type: "CMC", Code: ns("YDC")},
		{ID: "tlk-shp-147", DistrictID: "dist-ydg-031", Name: "Shahapur Taluk", Type: "Taluk", Code: ns("SHP")},
		{ID: "tlk-srp-148", DistrictID: "dist-ydg-031", Name: "Shorapur Taluk", Type: "Taluk", Code: ns("SRP")},
		{ID: "tlk-gmt-149", DistrictID: "dist-ydg-031", Name: "Gurmatkal Taluk", Type: "Taluk", Code: ns("GMT")},
	},
}

func getFallbackTaluksForDistrict(d *DistrictRecord, districtID string) []*TalukRecord {
	if d != nil {
		if list, ok := fallbackTaluks[d.Name]; ok {
			return list
		}
		if list, ok := fallbackTaluks[d.Code]; ok {
			return list
		}
		for name, list := range fallbackTaluks {
			if strings.EqualFold(name, d.Name) {
				return list
			}
		}
	}
	if list, ok := fallbackTaluks[districtID]; ok {
		return list
	}
	return nil
}

func (r *postgresRepo) GetDistricts(ctx context.Context) ([]*DistrictRecord, error) {
	var dbRecords []*DistrictRecord
	if r.db != nil && r.db.SQL != nil {
		query := `SELECT id::text, name, code, state FROM districts ORDER BY name ASC`
		rows, err := r.db.SQL.QueryContext(ctx, query)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var d DistrictRecord
				if err := rows.Scan(&d.ID, &d.Name, &d.Code, &d.State); err == nil {
					dbRecords = append(dbRecords, &d)
				}
			}
			if err := rows.Err(); err != nil {
				return nil, err
			}
		}
	}

	seenNames := make(map[string]bool)
	var finalRecords []*DistrictRecord

	for _, rec := range dbRecords {
		norm := strings.ToLower(strings.TrimSpace(rec.Name))
		seenNames[norm] = true
		finalRecords = append(finalRecords, rec)
	}

	for _, fb := range fallbackDistricts {
		norm := strings.ToLower(strings.TrimSpace(fb.Name))
		if !seenNames[norm] {
			seenNames[norm] = true
			finalRecords = append(finalRecords, fb)
		}
	}

	return finalRecords, nil
}

func (r *postgresRepo) GetTaluksByDistrict(ctx context.Context, districtID string) ([]*TalukRecord, error) {
	dist, _ := r.GetDistrictByID(ctx, districtID)
	masterList := getFallbackTaluksForDistrict(dist, districtID)

	var dbRecords []*TalukRecord
	if r.db != nil && r.db.SQL != nil {
		query := `SELECT id, district_id, name, type, code FROM taluks WHERE district_id = $1 ORDER BY name ASC`
		rows, err := r.db.SQL.QueryContext(ctx, query, districtID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var t TalukRecord
				if err := rows.Scan(&t.ID, &t.DistrictID, &t.Name, &t.Type, &t.Code); err == nil {
					dbRecords = append(dbRecords, &t)
				}
			}
			if err := rows.Err(); err != nil {
				return nil, err
			}
		}
	}

	seenNames := make(map[string]bool)
	var finalRecords []*TalukRecord

	for _, rec := range dbRecords {
		norm := strings.ToLower(strings.TrimSpace(rec.Name))
		seenNames[norm] = true
		finalRecords = append(finalRecords, rec)
	}

	for _, masterRec := range masterList {
		norm := strings.ToLower(strings.TrimSpace(masterRec.Name))
		if !seenNames[norm] {
			seenNames[norm] = true
			finalRecords = append(finalRecords, masterRec)
		}
	}

	if len(finalRecords) > 0 {
		return finalRecords, nil
	}

	dName := "District"
	if dist != nil {
		dName = dist.Name
	}
	return []*TalukRecord{
		{ID: districtID + "-tlk-1", DistrictID: districtID, Name: dName + " Main Headquarters", Type: "Municipal_Corporation", Code: ns("MAIN")},
		{ID: districtID + "-tlk-2", DistrictID: districtID, Name: dName + " North Taluk", Type: "Taluk", Code: ns("NTH")},
		{ID: districtID + "-tlk-3", DistrictID: districtID, Name: dName + " South Taluk", Type: "Taluk", Code: ns("STH")},
	}, nil
}

func (r *postgresRepo) resolveDepartmentUUID(ctx context.Context, input string) *string {
	if r.db == nil || r.db.SQL == nil {
		return nil
	}
	input = strings.TrimSpace(input)
	if input == "" {
		input = "dept"
	}
	var realID string
	err := r.db.SQL.QueryRowContext(ctx, `SELECT id::text FROM departments WHERE id::text = $1 OR UPPER(code) = UPPER($1) OR UPPER(name) = UPPER($1) OR UPPER(code) = 'DEPT' LIMIT 1`, input).Scan(&realID)
	if err == nil && realID != "" {
		return &realID
	}
	// Fallback to existing department in DB
	err = r.db.SQL.QueryRowContext(ctx, `SELECT id::text FROM departments ORDER BY created_at ASC LIMIT 1`).Scan(&realID)
	if err == nil && realID != "" {
		return &realID
	}
	// Ensure default department row exists
	_ = r.db.SQL.QueryRowContext(ctx, `
		INSERT INTO departments (name, code)
		VALUES ('General Administration', 'DEPT')
		ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code
		RETURNING id::text
	`).Scan(&realID)
	if realID != "" {
		return &realID
	}
	return nil
}

func (r *postgresRepo) resolveDistrictUUID(ctx context.Context, input string) *string {
	if input == "" || r.db == nil || r.db.SQL == nil {
		return nil
	}
	var realID string
	err := r.db.SQL.QueryRowContext(ctx, `SELECT id FROM districts WHERE id::text = $1 OR code = $1 OR LOWER(name) = LOWER($1) LIMIT 1`, input).Scan(&realID)
	if err == nil && realID != "" {
		return &realID
	}

	for _, d := range fallbackDistricts {
		if d.ID == input || d.Code == input || strings.EqualFold(d.Name, input) {
			_ = r.db.SQL.QueryRowContext(ctx, `
				INSERT INTO districts (name, code, state)
				VALUES ($1, $2, $3)
				ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code
				RETURNING id
			`, d.Name, d.Code, d.State).Scan(&realID)
			if realID != "" {
				return &realID
			}
		}
	}
	return nil
}

func (r *postgresRepo) resolveTalukUUID(ctx context.Context, distUUID *string, input string) *string {
	if input == "" || r.db == nil || r.db.SQL == nil {
		return nil
	}
	var realID string
	if distUUID != nil {
		err := r.db.SQL.QueryRowContext(ctx, `SELECT id FROM taluks WHERE (id::text = $1 OR code = $1 OR LOWER(name) = LOWER($1)) AND district_id = $2 LIMIT 1`, input, *distUUID).Scan(&realID)
		if err == nil && realID != "" {
			return &realID
		}
	} else {
		err := r.db.SQL.QueryRowContext(ctx, `SELECT id FROM taluks WHERE id::text = $1 OR code = $1 OR LOWER(name) = LOWER($1) LIMIT 1`, input).Scan(&realID)
		if err == nil && realID != "" {
			return &realID
		}
	}

	var tName, tType, tCode string
	for _, list := range fallbackTaluks {
		for _, t := range list {
			if t.ID == input || t.Name == input || strings.EqualFold(t.Name, input) {
				tName = t.Name
				tType = t.Type
				if t.Code.Valid {
					tCode = t.Code.String
				}
				break
			}
		}
	}

	if tName == "" {
		tName = input
		tType = "Taluk"
	}

	if distUUID != nil {
		_ = r.db.SQL.QueryRowContext(ctx, `
			INSERT INTO taluks (district_id, name, type, code)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (district_id, name) DO UPDATE SET type = EXCLUDED.type
			RETURNING id
		`, *distUUID, tName, tType, tCode).Scan(&realID)
		if realID != "" {
			return &realID
		}
	}

	return nil
}

func (r *postgresRepo) GetDistrictByID(ctx context.Context, id string) (*DistrictRecord, error) {
	if r.db != nil && r.db.SQL != nil {
		query := `SELECT id, name, code, state FROM districts WHERE id::text = $1 OR code = $1 OR LOWER(name) = LOWER($1)`
		var d DistrictRecord
		err := r.db.SQL.QueryRowContext(ctx, query, id).Scan(&d.ID, &d.Name, &d.Code, &d.State)
		if err == nil {
			return &d, nil
		}
	}

	for _, d := range fallbackDistricts {
		if d.ID == id || d.Code == id || strings.EqualFold(d.Name, id) {
			return d, nil
		}
	}
	return &DistrictRecord{ID: id, Name: "Bengaluru Urban", Code: "BLRU", State: "Karnataka"}, nil
}

func (r *postgresRepo) GetTalukByID(ctx context.Context, id string) (*TalukRecord, error) {
	if r.db != nil && r.db.SQL != nil {
		query := `SELECT id, district_id, name, type, code FROM taluks WHERE id::text = $1 OR code = $1 OR LOWER(name) = LOWER($1)`
		var t TalukRecord
		err := r.db.SQL.QueryRowContext(ctx, query, id).Scan(&t.ID, &t.DistrictID, &t.Name, &t.Type, &t.Code)
		if err == nil {
			return &t, nil
		}
	}

	for _, list := range fallbackTaluks {
		for _, t := range list {
			if t.ID == id || t.Name == id || strings.EqualFold(t.Name, id) {
				return t, nil
			}
		}
	}
	return &TalukRecord{ID: id, DistrictID: "dist-blru-001", Name: "Yelahanka Taluk", Type: "Municipal_Corporation", Code: ns("YLK")}, nil
}

func (r *postgresRepo) GetDepartmentCodeByID(ctx context.Context, id string) (string, string, error) {
	if r.db != nil && r.db.SQL != nil {
		query := `SELECT COALESCE(code, 'DEPT'), name FROM departments WHERE id::text = $1 OR code = $1 OR LOWER(name) = LOWER($1)`
		var code, name string
		err := r.db.SQL.QueryRowContext(ctx, query, id).Scan(&code, &name)
		if err == nil {
			return code, name, nil
		}
	}
	return "DEPT", "Department", nil
}

func (r *postgresRepo) CreateOfficerAccount(ctx context.Context, name, email, officialEmail, passHash, designation, deptID, districtID, talukID string) (string, error) {
	resolvedDeptID := r.resolveDepartmentUUID(ctx, deptID)
	resolvedDistID := r.resolveDistrictUUID(ctx, districtID)
	resolvedTalukID := r.resolveTalukUUID(ctx, resolvedDistID, talukID)

	loginEmail := strings.ToLower(strings.TrimSpace(officialEmail))
	if loginEmail == "" {
		loginEmail = strings.ToLower(strings.TrimSpace(email))
	}

	query := `
		INSERT INTO users (email, official_email, password_hash, name, role, designation, department_id, district_id, taluk_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'department', $5, $6, $7, $8, NOW(), NOW())
		ON CONFLICT (email) DO UPDATE SET
			official_email = EXCLUDED.official_email,
			password_hash = EXCLUDED.password_hash,
			name = EXCLUDED.name,
			role = 'department',
			designation = EXCLUDED.designation,
			department_id = EXCLUDED.department_id,
			district_id = EXCLUDED.district_id,
			taluk_id = EXCLUDED.taluk_id,
			updated_at = NOW()
		RETURNING id::text
	`
	var userID string
	err := r.db.SQL.QueryRowContext(ctx, query, loginEmail, loginEmail, passHash, name, designation, resolvedDeptID, resolvedDistID, resolvedTalukID).Scan(&userID)
	if err != nil {
		return "", fmt.Errorf("failed to insert officer account: %w", err)
	}
	return userID, nil
}
