import { Link } from "@tanstack/react-router";
import { Shield, Mail, Phone, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 md:mt-20 bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 md:py-14">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-lg font-bold">PGMS</div>
                <div className="text-xs uppercase tracking-wider opacity-80">Grievance Portal</div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed opacity-85 max-w-xs">
              A transparent, accountable system to report and resolve public issues across departments.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider opacity-95">Quick Links</h4>
            <ul className="mt-4 space-y-2 text-sm opacity-85">
              <li><Link to="/" className="hover:text-accent transition-colors">Home</Link></li>
              <li><Link to="/grievances" className="hover:text-accent transition-colors">Browse</Link></li>
              <li><Link to="/submit" className="hover:text-accent transition-colors">Submit</Link></li>
              <li><Link to="/my-complaints" className="hover:text-accent transition-colors">My Issues</Link></li>
              <li><Link to="/about" className="hover:text-accent transition-colors">About</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider opacity-95">Services</h4>
            <ul className="mt-4 space-y-2 text-sm opacity-85">
              <li>Roads & Transport</li>
              <li>Water Supply</li>
              <li>Sanitation</li>
              <li>Electricity</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider opacity-95">Contact</h4>
            <ul className="mt-4 space-y-2.5 text-sm opacity-85">
              <li className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 shrink-0 text-accent" /><span>1800-XXX-XXXX</span></li>
              <li className="flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 shrink-0 text-accent" /><span className="break-all">support@pgms.gov.in</span></li>
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0 text-accent" /><span>New Delhi, India</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 md:mt-12 border-t border-white/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs opacity-80">
          <p>© {new Date().getFullYear()} Public Grievance Management System</p>
          <p className="text-center sm:text-right">Built for transparency and accountable governance</p>
        </div>
      </div>
    </footer>
  );
}
