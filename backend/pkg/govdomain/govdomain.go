package govdomain

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
)

var nonAlphaNumRegex = regexp.MustCompile(`[^a-z0-9]+`)

func Slugify(input string) string {
	clean := strings.ToLower(strings.TrimSpace(input))
	clean = nonAlphaNumRegex.ReplaceAllString(clean, ".")
	return strings.Trim(clean, ".")
}

func AbbreviateDesignation(designation string) string {
	clean := strings.ToLower(strings.TrimSpace(designation))
	switch {
	case strings.Contains(clean, "assistant executive engineer") || strings.Contains(clean, "aee"):
		return "aee"
	case strings.Contains(clean, "assistant engineer") || strings.Contains(clean, "ae"):
		return "ae"
	case strings.Contains(clean, "executive engineer") || strings.Contains(clean, "ee"):
		return "ee"
	case strings.Contains(clean, "commissioner"):
		return "commissioner"
	case strings.Contains(clean, "inspector"):
		return "inspector"
	case strings.Contains(clean, "officer"):
		return "officer"
	default:
		slug := Slugify(clean)
		parts := strings.Split(slug, ".")
		if len(parts) > 1 {
			abbr := ""
			for _, p := range parts {
				if len(p) > 0 {
					abbr += string(p[0])
				}
			}
			return abbr
		}
		if len(slug) > 8 {
			return slug[:8]
		}
		return slug
	}
}

func GenerateOfficialEmail(designation, deptCode, talukName, districtName string) string {
	deptSlug := Slugify(deptCode)
	if deptSlug == "" {
		deptSlug = "dept"
	}
	talukSlug := Slugify(strings.ReplaceAll(strings.ReplaceAll(talukName, "Taluk", ""), "Municipal", ""))
	if talukSlug == "" {
		talukSlug = "central"
	}
	districtSlug := Slugify(strings.ReplaceAll(districtName, "Urban", ""))
	if districtSlug == "" {
		districtSlug = "kar"
	}

	return fmt.Sprintf("%s.%s.%s@karnataka.gov.in", deptSlug, talukSlug, districtSlug)
}

func GenerateSecureTempPassword() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("GovPass#%s!", hex.EncodeToString(b)[:8]), nil
}
