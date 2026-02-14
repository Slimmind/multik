import "./footer.styles.css";
import { VERSION } from "../../version";

export const Footer = () => {
  return (
    <footer className="footer">
        <small className="copyright">
          slimmind &copy; {new Date().getFullYear()} Multik. All rights reserved.
        </small>
        <small className="semver">
          v{VERSION}
        </small>
    </footer>
  )
}