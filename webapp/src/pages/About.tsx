import { Link } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import '../App.css'

declare const __APP_VERSION__: string

export default function About() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-brand">
            <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="11" cy="16" r="9" fill="#dde8f8" stroke="#3a6fba" strokeWidth="2.5"/>
              <circle cx="24" cy="10" r="5" fill="#e6f5e6" stroke="#3a9943" strokeWidth="2"/>
              <rect x="17" y="10" width="5" height="3" rx="1" fill="#e05252" transform="rotate(-30 19.5 11.5)"/>
            </svg>
            <div>
              <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="app-header-name">CellGen</span>
              </Link>
              <span className="app-header-sub">Cellular Genome Organisation Visualiser</span>
            </div>
          </div>
          <nav className="app-header-nav">
            <span className="app-header-version">v{__APP_VERSION__}</span>
            <ThemeToggle />
            <Link to="/" className="app-header-link-btn">← Back</Link>
            <a href="https://github.com/cgps-group/cell-format" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
      </header>

      <main className="app-main about-page">
        <div className="about-page-inner">
          <h1 className="about-page-title">About CellGen</h1>
          <p className="about-page-lead">
            Genomes are not just flat collections of sequences. A bacterial isolate may carry
            a chromosome and several plasmids, while a fungal chromosome may contain a large
            mobile element such as a Starship. These structures can themselves contain genes,
            gene clusters and other elements. GenBank and GFF describe sequence features, but
            do not provide a compact notation for these containment relationships.
          </p>
          <p className="about-page-lead">
            CellGen is a compact, human-readable notation that fills that gap. Inspired
            by the Newick format for phylogenetic trees, it encodes the complete genomic
            organisation of a cell, including chromosomes and arbitrarily nested biological
            entities, in a single line of text.
          </p>

          <h2>The notation at a glance</h2>
          <p>
            Parentheses <code>()</code> mean chromosome, and only chromosome. Curly braces
            <code>{'{}'}</code> mean any other biological entity, including a plasmid, mobile
            element, gene or gene cluster. A <code>type</code> attribute records the entity class
            when the label alone is not sufficient. Nesting shows what is contained within what.
            A comma separates elements in the same cell; a semicolon separates different cells.
          </p>
          <table className="about-table">
            <tbody>
              <tr>
                <td><code>()chr1</code></td>
                <td>A chromosome labelled <em>chr1</em></td>
              </tr>
              <tr>
                <td><code>()chr1, {'{}'}pBAD</code></td>
                <td>Chromosome plus a plasmid in the same cell</td>
              </tr>
              <tr>
                <td><code>{'{ {}blaKPC-3 }pKpQIL'}</code></td>
                <td>Resistance gene <em>blaKPC-3</em> nested inside plasmid <em>pKpQIL</em></td>
              </tr>
              <tr>
                <td><code>{'{ { {}blaKPC-3 }Tn4401 }pKpQIL'}</code></td>
                <td>KPC gene inside a transposon inside a plasmid, three levels deep</td>
              </tr>
              <tr>
                <td><code>{'({ {}DUF3435_captain[type="gene"], {}cargo_gene_cluster[type="gene_cluster"] }Starship[type="starship"])chromosome'}</code></td>
                <td>Schematic fungal chromosome containing a Starship, its captain gene and cargo</td>
              </tr>
              <tr>
                <td><code>A ; B</code></td>
                <td>Two cells, e.g. from a metagenomics sample</td>
              </tr>
              <tr>
                <td><code>[key="value"]</code></td>
                <td>Metadata annotation on any element</td>
              </tr>
            </tbody>
          </table>

          <h2>Why it matters</h2>
          <p>
            Mobile genetic elements are the main vehicle for spread of antimicrobial
            resistance. Understanding <em>where</em> a resistance gene sits — on a conjugative
            plasmid, inside a transposon, or integrated into the chromosome — is just as
            important as knowing the gene is there. CellGen makes that structure explicit
            and comparable across isolates without requiring large intermediate files or
            bespoke graph databases.
          </p>
          <p>
            The recursive grammar allows structures of any depth. A single CellGen string
            can capture, for example, a <em>Klebsiella pneumoniae</em> chromosome carrying the
            <em>blaKPC-3</em> gene nested inside transposon Tn4401 inside the IncFII/IncR
            plasmid pKpQIL, exactly the arrangement seen in KPC-producing outbreak strains.
          </p>
          <p>
            The fungal Starship example is deliberately schematic. It represents a Starship
            integrated in a chromosome, with a DUF3435 captain gene and a cargo gene cluster,
            following the architecture described by{' '}
            <a href="https://doi.org/10.1093/molbev/msac109" target="_blank" rel="noreferrer">
              Gluck-Thaler and colleagues
            </a>
            . It does not claim sequence-resolved boundaries for a particular isolate.
          </p>

          <h2>This tool</h2>
          <p>
            This web application lets you build and visualise CellGen strings interactively.
            Use the builder to add chromosomes and nested entities by clicking, or type
            the format string directly. You can also import a GenBank or GFF3 file to auto-generate
            a starting string from an existing assembly. The diagram preview updates live.
          </p>
          <p>
            Strings and SVG diagrams can be downloaded for use in presentations or manuscripts.
          </p>

          <h2>Team</h2>
          <p>
            Developed at the{' '}
            <a href="https://www.pathogensurveillance.net" target="_blank" rel="noreferrer">
              Centre for Genomic Pathogen Surveillance
            </a>
            , Pandemic Sciences Institute, University of Oxford — part of the WHO Collaborating
            Centre on Genomic Surveillance of AMR and the NIHR Global Health Research Unit.
          </p>
          <ul className="about-authors">
            <li>Julio Diaz Caballero</li>
            <li>Nabil-Fareed Alikhan</li>
            <li>Khalil AbuDahab</li>
            <li>David Aanensen</li>
          </ul>

          <h2>Links</h2>
          <div className="about-links">
            <a href="https://github.com/cgps-group/cell-format" target="_blank" rel="noreferrer">GitHub repository</a>
            <a href="https://github.com/cgps-group/cell-format/issues" target="_blank" rel="noreferrer">Report a bug</a>
            <a href="https://www.pathogensurveillance.net" target="_blank" rel="noreferrer">CGPS website</a>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        CellGen &mdash; cellular genome organisation &bull;{' '}
        <a href="https://github.com/cgps-group/cell-format/issues" target="_blank" rel="noreferrer">
          Report a bug
        </a>
      </footer>
    </div>
  )
}
