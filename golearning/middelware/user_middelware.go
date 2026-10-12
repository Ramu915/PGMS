package middelware

import (
	"log"
	"net/http"
	"time"
)

func UserMiddelWare(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		start := time.Now()
		log.Printf("Request Time: %s\n", start)

		log.Printf("Request URL : %s\n", r.URL)
		log.Printf("Request Body: %v\n", r.Body)
		log.Printf("Request Method : %s\n", r.Method)

		next.ServeHTTP(w, r)

		end := time.Since(start)
		log.Printf("Response Time: %s\n", end)
	})
}
